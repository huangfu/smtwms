using Microsoft.AspNetCore.Mvc;
using SmtWms.Application.Contracts;
using SmtWms.Application.Services;
using SmtWms.WebApi.Middleware;

namespace SmtWms.WebApi.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(AuthAppService authService) : ControllerBase
{
    [HttpPost("register")]
    public async Task<ActionResult<AuthSuccessResponse>> Register(
        [FromBody] RegisterRequest req,
        CancellationToken ct)
    {
        var result = await authService.RegisterAsync(req, ct);
        SetSessionCookie(result.Token);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthSuccessResponse>> Login(
        [FromBody] LoginRequest req,
        CancellationToken ct)
    {
        var result = await authService.LoginAsync(req, ct);
        SetSessionCookie(result.Token);
        return Ok(result);
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        var token = HttpContext.GetSessionToken();
        await authService.LogoutAsync(token, ct);
        Response.Cookies.Delete(SessionAuthMiddleware.SessionCookieName, BuildCookieOptions(DateTimeOffset.UnixEpoch));
        return Ok(new { ok = true });
    }

    [HttpGet("me")]
    public ActionResult<AuthMeResponse> Me()
    {
        var user = HttpContext.GetAuthUser();
        return Ok(new AuthMeResponse(true, user));
    }

    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword(
        [FromBody] ChangePasswordRequest req,
        CancellationToken ct)
    {
        var user = HttpContext.RequireAuthUser();
        await authService.ChangePasswordAsync(user.Uid, req, ct);
        return Ok(new { ok = true });
    }

    private void SetSessionCookie(string token)
    {
        Response.Cookies.Append(
            SessionAuthMiddleware.SessionCookieName,
            token,
            BuildCookieOptions(DateTimeOffset.UtcNow.AddDays(7)));
    }

    private CookieOptions BuildCookieOptions(DateTimeOffset expires) => new()
    {
        HttpOnly = true,
        Secure = Request.IsHttps,
        SameSite = Request.IsHttps ? SameSiteMode.None : SameSiteMode.Lax,
        Path = "/",
        Expires = expires,
    };
}
