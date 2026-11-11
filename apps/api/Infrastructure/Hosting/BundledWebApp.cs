namespace Orbit.Api.Infrastructure.Hosting;

/// <summary>
/// Lets one process serve the whole app on a person's own computer: when the compiled web app sits in
/// <c>wwwroot</c> (a published build; the dev setup has none), the API serves it and moves itself under
/// <c>/api</c>, where the web app already sends its calls.
/// </summary>
public static class BundledWebApp
{
    public const string ApiPathBase = "/api";
    private const string IndexFile = "index.html";
    private const string HealthPath = "/health";

    /// <summary>Whether a compiled web app is in the web root.</summary>
    /// <example><code>if (BundledWebApp.IsPresent(app.Environment)) { }</code></example>
    public static bool IsPresent(IWebHostEnvironment environment) =>
        !string.IsNullOrEmpty(environment.WebRootPath)
        && File.Exists(Path.Combine(environment.WebRootPath, IndexFile));

    /// <summary>
    /// Registers the serving of the web app's files and, for any address that is not an API call or a file (a
    /// page the web app routes itself, such as <c>/finances</c> on reload), of its start page. It is a startup
    /// filter so it runs before routing: routing would otherwise pick the API route of a page named like it
    /// (<c>/routines</c>) and the file server skips a request that has a route.
    /// </summary>
    /// <example><code>builder.Services.AddBundledWebApp();</code></example>
    public static IServiceCollection AddBundledWebApp(this IServiceCollection services) =>
        services.AddTransient<IStartupFilter, BundledWebAppStartup>();

    private sealed class BundledWebAppStartup(IWebHostEnvironment environment) : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            if (IsPresent(environment))
            {
                app.UsePathBase(ApiPathBase);
                app.Use(ServeStartPageForPages);
                app.UseDefaultFiles();
                app.UseStaticFiles();
            }
            next(app);
        };
    }

    private static Task ServeStartPageForPages(HttpContext context, RequestDelegate next)
    {
        var isApiCall = context.Request.PathBase.HasValue;
        var isFile = Path.HasExtension(context.Request.Path.Value);
        var isHealth = context.Request.Path.Equals(HealthPath);
        if (!isApiCall && !isFile && !isHealth) context.Request.Path = "/" + IndexFile;
        return next(context);
    }
}
