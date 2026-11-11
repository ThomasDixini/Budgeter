using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Text.Json.Serialization;
using Orbit.Api.Application.Backups;
using Orbit.Api.Application.Categories;
using Orbit.Api.Application.Finances;
using Orbit.Api.Application.Goals;
using Orbit.Api.Application.Investments;
using Orbit.Api.Application.Routines;
using Orbit.Api.Application.Tasks;
using Orbit.Api.Endpoints;
using Orbit.Api.Infrastructure.Auth;
using Orbit.Api.Infrastructure.Cdi;
using Orbit.Api.Infrastructure.Hosting;
using Orbit.Api.Infrastructure.Quotes;
using Orbit.Api.Infrastructure.Sqlite;

[assembly: InternalsVisibleTo("Orbit.Api.Tests")]

// Bodies are small JSON documents (a full routine is a few KB); the cap keeps an oversized one from
// being read, validated and stored row by row.
const long maxRequestBodyBytes = 256 * 1024;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = maxRequestBodyBytes);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    // Enums travel as the web app spells them ("frequency", "weekly") and absent optionals are omitted.
    // Numbers are not accepted for enums: "tracking": 7 would be stored and silently never match anything.
    options.SerializerOptions.Converters.Add(
        new JsonStringEnumConverter(JsonNamingPolicy.CamelCase, allowIntegerValues: false));
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    options.SerializerOptions.RespectNullableAnnotations = true;
    options.SerializerOptions.RespectRequiredConstructorParameters = true;
});
builder.Services.AddProblemDetails();
// A published build carries the web app in wwwroot; see BundledWebApp.
builder.Services.AddBundledWebApp();
builder.Services.AddExceptionHandler<BusinessExceptionHandler>();
builder.Services.AddOrbitAuth(
    builder.Environment.IsDevelopment(), Path.Combine(builder.Environment.ContentRootPath, "auth-dev.key"));
builder.Services.AddSqlitePersistence();
builder.Services.AddCdiRateSource(builder.Configuration);
builder.Services.AddQuoteSource(builder.Configuration);
builder.Services.AddScoped<ListCategories>();
builder.Services.AddScoped<CreateCategory>();
builder.Services.AddScoped<UpdateCategory>();
builder.Services.AddScoped<DeleteCategory>();
builder.Services.AddScoped<ListGoals>();
builder.Services.AddScoped<CreateGoal>();
builder.Services.AddScoped<SetGoalAchievement>();
builder.Services.AddScoped<UpdateGoal>();
builder.Services.AddScoped<DeleteGoal>();
builder.Services.AddScoped<GoalCredits>();
builder.Services.AddScoped<ListRoutines>();
builder.Services.AddScoped<SaveRoutine>();
builder.Services.AddScoped<DeleteRoutine>();
builder.Services.AddScoped<GetRoutineRotation>();
builder.Services.AddScoped<SaveRoutineRotation>();
builder.Services.AddScoped<ListBlockOutcomes>();
builder.Services.AddScoped<RecordBlockOutcome>();
builder.Services.AddScoped<UndoBlockOutcome>();
builder.Services.AddScoped<ListTasks>();
builder.Services.AddScoped<SaveTask>();
builder.Services.AddScoped<DeleteTask>();
builder.Services.AddScoped<TaskCompletions>();
builder.Services.AddScoped<ListFinanceCategories>();
builder.Services.AddScoped<SaveFinanceCategory>();
builder.Services.AddScoped<DeleteFinanceCategory>();
builder.Services.AddScoped<GetIncomeSplit>();
builder.Services.AddScoped<SaveIncomeSplit>();
builder.Services.AddScoped<ListAccounts>();
builder.Services.AddScoped<SaveAccount>();
builder.Services.AddScoped<DeleteAccount>();
builder.Services.AddScoped<ListAccountStatements>();
builder.Services.AddScoped<ListTransactions>();
builder.Services.AddScoped<SaveTransaction>();
builder.Services.AddScoped<DeleteTransaction>();
builder.Services.AddScoped<ListCardPayments>();
builder.Services.AddScoped<SaveCardPayment>();
builder.Services.AddScoped<DeleteCardPayment>();
builder.Services.AddScoped<ListBillsAgenda>();
builder.Services.AddScoped<SaveBill>();
builder.Services.AddScoped<DeleteBill>();
builder.Services.AddScoped<SettleBill>();
builder.Services.AddScoped<ReopenBill>();
builder.Services.AddScoped<ListSinkingFunds>();
builder.Services.AddScoped<SaveSinkingFund>();
builder.Services.AddScoped<DeleteSinkingFund>();
builder.Services.AddScoped<RollSinkingFunds>();
builder.Services.AddScoped<MonthEndPrices>();
builder.Services.AddScoped<LatestPrices>();
builder.Services.AddScoped<GetPortfolio>();
builder.Services.AddScoped<SaveInvestment>();
builder.Services.AddScoped<DeleteInvestment>();
builder.Services.AddScoped<SaveTrade>();
builder.Services.AddScoped<DeleteTrade>();
builder.Services.AddScoped<SaveIncome>();
builder.Services.AddScoped<DeleteIncome>();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<ExportBackup>();
builder.Services.AddScoped<RestoreBackup>();

var app = builder.Build();

app.UseExceptionHandler();
app.UseAuthentication();
app.UseAuthorization();
// Answers once the database is ready (the initializer runs before the server listens), for whatever
// waits on the API to start: the E2E runner today, a serverless platform later.
app.MapGet("/health", () => Results.NoContent()).AllowAnonymous();
app.MapAuthEndpoints();
// Everything else belongs to a signed-in user; the fallback policy rejects requests without a valid token.
app.MapCategoryEndpoints();
app.MapGoalEndpoints();
app.MapRoutineEndpoints();
app.MapRoutineRotationEndpoints();
app.MapBlockOutcomeEndpoints();
app.MapTaskEndpoints();
app.MapFinanceReferenceEndpoints();
app.MapAccountEndpoints();
app.MapTransactionEndpoints();
app.MapCardPaymentEndpoints();
app.MapBillEndpoints();
app.MapSinkingFundEndpoints();
app.MapInvestmentEndpoints();
app.MapIncomeSplitEndpoints();
app.MapBackupEndpoints();

await app.RunAsync();
