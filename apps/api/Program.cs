using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Text.Json.Serialization;
using Budgeter.Api.Application.Categories;
using Budgeter.Api.Application.Goals;
using Budgeter.Api.Application.Routines;
using Budgeter.Api.Application.Tasks;
using Budgeter.Api.Endpoints;
using Budgeter.Api.Infrastructure.Sqlite;

[assembly: InternalsVisibleTo("Budgeter.Api.Tests")]

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    // Enums travel as the web app spells them ("frequency", "weekly") and absent optionals are omitted.
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    options.SerializerOptions.RespectNullableAnnotations = true;
    options.SerializerOptions.RespectRequiredConstructorParameters = true;
});
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<BusinessExceptionHandler>();
builder.Services.AddSqlitePersistence();
builder.Services.AddScoped<ListCategories>();
builder.Services.AddScoped<CreateCategory>();
builder.Services.AddScoped<ListGoals>();
builder.Services.AddScoped<CreateGoal>();
builder.Services.AddScoped<LogGoalProgress>();
builder.Services.AddScoped<ListRoutines>();
builder.Services.AddScoped<SaveRoutine>();
builder.Services.AddScoped<DeleteRoutine>();
builder.Services.AddScoped<ListTasks>();
builder.Services.AddScoped<SaveTask>();
builder.Services.AddScoped<DeleteTask>();
builder.Services.AddScoped<TaskCompletions>();

var app = builder.Build();

app.UseExceptionHandler();
app.MapGet("/", () => "Hello World!");
app.MapCategoryEndpoints();
app.MapGoalEndpoints();
app.MapRoutineEndpoints();
app.MapTaskEndpoints();

await app.RunAsync();
