namespace SmtWms.Application.Contracts;

public sealed record AuthUserProfileDto(
    string Uid,
    string? Username,
    string Email,
    string? DisplayName,
    string AuthProvider);

public sealed record RegisterRequest(string Username, string Password, string? DisplayName);

public sealed record LoginRequest(string Username, string Password);

public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public sealed record AuthSuccessResponse(bool Ok, AuthUserProfileDto User, string Token);

public sealed record AuthMeResponse(bool Ok, AuthUserProfileDto? User);

public sealed record ApiEnvelope<TPayload>(bool Ok, WmsStateDto State, TPayload? Payload = default);

public sealed record ApiErrorResponse(bool Ok, string Error);
