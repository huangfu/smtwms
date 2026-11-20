using System.Text.RegularExpressions;
using SmtWms.Application.Contracts;
using SmtWms.Application.Interfaces;
using SmtWms.Domain.Common;
using SmtWms.Domain.Entities;
using SmtWms.Domain.Repositories;

namespace SmtWms.Application.Services;

public sealed partial class AuthAppService(
    IUserRepository userRepository,
    IPasswordHasher passwordHasher)
{
    public const string SessionTokenPrefix = "wms_sess_";
    private static readonly TimeSpan SessionLifetime = TimeSpan.FromDays(7);

    [GeneratedRegex(@"^[a-zA-Z0-9._@-]{3,32}$")]
    private static partial Regex UsernameRegex();

    public async Task<AuthSuccessResponse> RegisterAsync(RegisterRequest req, CancellationToken ct = default)
    {
        var username = NormalizeUsername(req.Username);
        ValidateUsername(username);
        ValidatePassword(req.Password);

        if (await userRepository.UsernameExistsAsync(username, ct))
            throw new DomainException($"账号 \"{username}\" 已被注册，请直接登录或更换账号名。", 409);

        var uid = $"local_{Guid.NewGuid()}";
        var displayName = string.IsNullOrWhiteSpace(req.DisplayName) ? username : req.DisplayName.Trim();
        var email = username.Contains('@') ? username : $"{username}@wms.local";
        var now = DateTime.UtcNow;

        var token = passwordHasher.GenerateSessionToken();
        var user = new UserAccount
        {
            Uid = uid,
            Email = email,
            DisplayName = displayName,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };
        var credential = new UserCredential
        {
            UserUid = uid,
            Username = username,
            PasswordHash = passwordHasher.HashPassword(req.Password),
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };
        var session = new UserSession
        {
            TokenHash = passwordHasher.HashSessionToken(token),
            UserUid = uid,
            ExpiresAtUtc = now.Add(SessionLifetime),
            CreatedAtUtc = now,
        };

        await userRepository.CreateUserWithCredentialAndSessionAsync(user, credential, session, ct);

        return new AuthSuccessResponse(
            true,
            new AuthUserProfileDto(uid, username, email, displayName, "password"),
            token);
    }

    public async Task<AuthSuccessResponse> LoginAsync(LoginRequest req, CancellationToken ct = default)
    {
        var username = NormalizeUsername(req.Username);
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrEmpty(req.Password))
            throw new DomainException("请输入账号和密码", 400);

        var found = await userRepository.FindByUsernameAsync(username, ct);
        if (found is null || !passwordHasher.VerifyPassword(req.Password, found.Value.Credential.PasswordHash))
            throw new DomainException("账号或密码错误，请检查后重试。", 401);

        var (user, credential) = found.Value;
        var token = passwordHasher.GenerateSessionToken();
        var now = DateTime.UtcNow;
        await userRepository.CreateSessionAsync(new UserSession
        {
            TokenHash = passwordHasher.HashSessionToken(token),
            UserUid = user.Uid,
            ExpiresAtUtc = now.Add(SessionLifetime),
            CreatedAtUtc = now,
        }, ct);

        return new AuthSuccessResponse(
            true,
            new AuthUserProfileDto(user.Uid, credential.Username, user.Email, user.DisplayName ?? credential.Username, "password"),
            token);
    }

    public async Task<AuthUserProfileDto?> VerifySessionAsync(string token, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(token) || !token.StartsWith(SessionTokenPrefix, StringComparison.Ordinal))
            return null;

        var found = await userRepository.FindValidSessionAsync(
            passwordHasher.HashSessionToken(token),
            DateTime.UtcNow,
            ct);

        if (found is null) return null;
        var (user, credential) = found.Value;
        return new AuthUserProfileDto(
            user.Uid,
            credential.Username,
            user.Email,
            user.DisplayName ?? credential.Username,
            "password");
    }

    public async Task LogoutAsync(string? token, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(token) || !token.StartsWith(SessionTokenPrefix, StringComparison.Ordinal))
            return;
        await userRepository.RevokeSessionAsync(passwordHasher.HashSessionToken(token), ct);
    }

    public async Task ChangePasswordAsync(string userUid, ChangePasswordRequest req, CancellationToken ct = default)
    {
        ValidatePassword(req.NewPassword);
        var credential = await userRepository.FindCredentialByUidAsync(userUid, ct);
        if (credential is null)
            throw new DomainException("当前账号不支持修改本地密码。", 400);

        if (!passwordHasher.VerifyPassword(req.CurrentPassword, credential.PasswordHash))
            throw new DomainException("当前密码不正确，请重新输入。", 400);

        await userRepository.UpdatePasswordHashAsync(
            userUid,
            passwordHasher.HashPassword(req.NewPassword),
            ct);
    }

    private static string NormalizeUsername(string raw) => (raw ?? string.Empty).Trim().ToLowerInvariant();

    private static void ValidateUsername(string username)
    {
        if (string.IsNullOrWhiteSpace(username))
            throw new DomainException("请输入账号名称", 400);
        if (!UsernameRegex().IsMatch(username))
            throw new DomainException("账号长度需在 3 - 32 位，且仅支持字母、数字及 . _ - @ 符号", 400);
    }

    private static void ValidatePassword(string password)
    {
        if (string.IsNullOrEmpty(password) || password.Length < 6)
            throw new DomainException("密码长度不能少于 6 位", 400);
        if (password.Length > 128)
            throw new DomainException("密码长度不能超过 128 位", 400);
    }
}
