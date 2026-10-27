using Budgeter.Api.Application.Categories;
using Budgeter.Api.Application.Goals;
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
        services.AddSingleton<ICategoryRepository, SqliteCategoryRepository>();
        services.AddSingleton<IGoalRepository, SqliteGoalRepository>();
        services.AddSingleton<IRoutineRepository, SqliteRoutineRepository>();
        services.AddSingleton<IBlockOutcomeRepository, SqliteBlockOutcomeRepository>();
        services.AddSingleton<ITaskRepository, SqliteTaskRepository>();
        services.AddHostedService<SqliteDatabaseInitializer>();
        return services;
    }
}
