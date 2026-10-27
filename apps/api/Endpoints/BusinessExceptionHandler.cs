using Budgeter.Api.Application;
using Budgeter.Api.Domain;
using Microsoft.AspNetCore.Diagnostics;

namespace Budgeter.Api.Endpoints;

/// <summary>
/// Turns malformed requests and broken business rules into 400 and missing records into 404 problem
/// responses (in Development, minimal APIs throw on malformed bodies instead of answering 400 themselves).
/// </summary>
internal sealed class BusinessExceptionHandler(
    IProblemDetailsService problemDetails,
    ILogger<BusinessExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var statusCode = StatusCodeFor(exception);
        if (statusCode is null) return false;

        logger.LogWarning("Rejected {Method} {Path}: {Reason}",
            httpContext.Request.Method, httpContext.Request.Path, exception.Message);
        httpContext.Response.StatusCode = statusCode.Value;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails = { Status = statusCode, Detail = exception.Message },
        });
    }

    private static int? StatusCodeFor(Exception exception) => exception switch
    {
        DomainRuleException => StatusCodes.Status400BadRequest,
        ResourceNotFoundException => StatusCodes.Status404NotFound,
        BadHttpRequestException badRequest => badRequest.StatusCode,
        _ => null,
    };
}
