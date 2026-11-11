using Orbit.Api.Application;
using Orbit.Api.Application.Backups;
using Orbit.Api.Application.Categories;
using Orbit.Api.Application.Finances;
using Orbit.Api.Application.Goals;
using Orbit.Api.Application.Investments;
using Orbit.Api.Application.Routines;
using Orbit.Api.Application.Tasks;
using Orbit.Api.Application.Users;

namespace Orbit.Api.Infrastructure.Sqlite;

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
        services.AddSingleton(provider => new SqliteConnectionFactory(
            provider.GetRequiredService<SqliteOptions>().ConnectionString,
            provider.GetRequiredService<ICurrentUser>()));
        services.AddSingleton<IUserRepository, SqliteUserRepository>();
        services.AddSingleton<IUnitOfWork, SqliteUnitOfWork>();
        services.AddSingleton<ICategoryRepository, SqliteCategoryRepository>();
        services.AddSingleton<IGoalRepository, SqliteGoalRepository>();
        services.AddSingleton<IGoalProgressLedger, SqliteGoalProgressLedger>();
        services.AddSingleton<IRoutineRepository, SqliteRoutineRepository>();
        services.AddSingleton<IRoutineRotationRepository, SqliteRoutineRotationRepository>();
        services.AddSingleton<IBlockOutcomeRepository, SqliteBlockOutcomeRepository>();
        services.AddSingleton<ITaskRepository, SqliteTaskRepository>();
        services.AddSingleton<IFinanceCategoryRepository, SqliteFinanceCategoryRepository>();
        services.AddSingleton<IAccountRepository, SqliteAccountRepository>();
        services.AddSingleton<IMoneyTransactionRepository, SqliteMoneyTransactionRepository>();
        services.AddSingleton<ICardPaymentRepository, SqliteCardPaymentRepository>();
        services.AddSingleton<IIncomeSplitRepository, SqliteIncomeSplitRepository>();
        services.AddSingleton<IBillRepository, SqliteBillRepository>();
        services.AddSingleton<ISinkingFundRepository, SqliteSinkingFundRepository>();
        services.AddSingleton<IInvestmentRepository, SqliteInvestmentRepository>();
        services.AddSingleton<ICdiRateStore, SqliteCdiRateStore>();
        services.AddSingleton<IMonthEndPriceStore, SqliteMonthEndPriceStore>();
        services.AddSingleton<IDatabaseBackup, SqliteDatabaseBackup>();
        services.AddHostedService<SqliteDatabaseInitializer>();
        return services;
    }
}
