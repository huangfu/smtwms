using SmtWms.Application.Contracts;
using SmtWms.Application.Services;

namespace SmtWms.WebApi.Middleware;

public sealed class SessionAuthMiddleware(RequestDelegate next)
{
    public const string SessionCookieName = "wms_session";
    public const string AuthUserItemKey = "SmtWms.AuthUser";
    public const string SessionTokenItemKey = "SmtWms.SessionToken";

    public async Task InvokeAsync(HttpContext context, AuthAppService authService)
    {
        var token = ExtractToken(context.Request);
        if (!string.IsNullOrWhiteSpace(token))
        {
            context.Items[SessionTokenItemKey] = token;
            var user = await authService.VerifySessionAsync(token, context.RequestAborted);
            if (user is not null)
            {
                context.Items[AuthUserItemKey] = user;
            }
        }

        await next(context);
    }

    private static string? ExtractToken(HttpRequest request)
    {
        if (request.Headers.TryGetValue("Authorization", out var authHeader))
        {
            var raw = authHeader.ToString();
            if (raw.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                var bearer = raw["Bearer ".Length..].Trim();
                if (!string.IsNullOrWhiteSpace(bearer)) return bearer;
            }
        }

        if (request.Cookies.TryGetValue(SessionCookieName, out var cookieToken) &&
            !string.IsNullOrWhiteSpace(cookieToken))
        {
            return cookieToken.Trim();
        }

        return null;
    }
}

public static class HttpContextAuthExtensions
{
    public static AuthUserProfileDto? GetAuthUser(this HttpContext context)
        => context.Items.TryGetValue(SessionAuthMiddleware.AuthUserItemKey, out var value)
            ? value as AuthUserProfileDto
            : null;

    public static AuthUserProfileDto RequireAuthUser(this HttpContext context)
        => context.GetAuthUser()
           ?? throw new SmtWms.Domain.Common.DomainException("未登录或会话已过期，请重新登录。", 401);

    public static string? GetSessionToken(this HttpContext context)
        => context.Items.TryGetValue(SessionAuthMiddleware.SessionTokenItemKey, out var value)
            ? value as string
            : null;
}
