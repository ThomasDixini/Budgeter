using Budgeter.Api.Application;
using Budgeter.Api.Application.Categories;
using Budgeter.Api.Application.Finances;
using Budgeter.Api.Application.Goals;
using Budgeter.Api.Application.Investments;
using Budgeter.Api.Application.Routines;
using Budgeter.Api.Application.Tasks;

namespace Budgeter.Api.Infrastructure.Sqlite;

/// <summary>Wires the SQLite adapters behind the repository ports.</summary>
public static class SqlitePersistenceRegistration
{
    /// <summary>
    /// Registers the options (read from configuration), connection factory, repositories and the
    /// startup schema initializer.
    /// </summary>
    /// <example><code>builder.Services.AddSqlitePersistence();</code></example>
    public static IServiceCollection AddSqlitePersistence(this IServiceCollection services)
    {
        // Resolved lazily so configuration overrides added after registration (e.g. by tests) still apply.
        services.AddSingleton(provider => SqliteOptions.FromConfiguration(provider.GetRequiredService<IConfiguration>()));
        services.AddSingleton(provider =>
            new SqliteConnectionFactory(provider.GetRequiredService<SqliteOptions>().ConnectionString));
        services.AddSingleton<IUnitOfWork, SqliteUnitOfWork>();
        services.AddSingleton<ICategoryRepository, SqliteCategoryRepository>();
        services.AddSingleton<IGoalRepository, SqliteGoalRepository>();
        services.AddSingleton<IGoalProgressLedger, SqliteGoalProgressLedger>();
        services.AddSingleton<IRoutineRepository, SqliteRoutineRepository>();
        services.AddSingleton<IBlockOutcomeRepository, SqliteBlockOutcomeRepository>();
        services.AddSingleton<ITaskRepository, SqliteTaskRepository>();
        services.AddSingleton<IFinanceCategoryRepository, SqliteFinanceCategoryRepository>();
        services.AddSingleton<IAccountRepository, SqliteAccountRepository>();
        services.AddSingleton<IMoneyTransactionRepository, SqliteMoneyTransactionRepository>();
        services.AddSingleton<ICardPaymentRepository, SqliteCardPaymentRepository>();
        services.AddSingleton<IIncomeSplitRepository, SqliteIncomeSplitRepository>();
        services.AddSingleton<IBillRepository, SqliteBillRepository>();
        services.AddSingleton<IInvestmentRepository, SqliteInvestmentRepository>();
        services.AddSingleton<ICdiRateStore, SqliteCdiRateStore>();
        services.AddHostedService<SqliteDatabaseInitializer>();
        return services;
    }
}
