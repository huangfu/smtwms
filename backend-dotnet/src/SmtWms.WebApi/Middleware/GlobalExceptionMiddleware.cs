using System.Text.Json;
using SmtWms.Application.Contracts;
using SmtWms.Domain.Common;

namespace SmtWms.WebApi.Middleware;

public sealed class GlobalExceptionMiddleware(
    RequestDelegate next,
    ILogger<GlobalExceptionMiddleware> logger)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (DomainException ex)
        {
            context.Response.StatusCode = ex.StatusCode;
            context.Response.ContentType = "application/json; charset=utf-8";
            var payload = new ApiErrorResponse(false, ex.Message);
            await context.Response.WriteAsync(JsonSerializer.Serialize(payload, JsonOptions));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled API exception on {Method} {Path}", context.Request.Method, context.Request.Path);
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/json; charset=utf-8";
            var payload = new ApiErrorResponse(false, "服务器内部异常，请检查后端日志或数据库连接状态。");
            await context.Response.WriteAsync(JsonSerializer.Serialize(payload, JsonOptions));
        }
    }
}
