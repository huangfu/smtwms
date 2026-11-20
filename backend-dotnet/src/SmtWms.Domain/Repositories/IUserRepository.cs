using SmtWms.Domain.Entities;

namespace SmtWms.Domain.Repositories;

public interface IUserRepository
{
    Task<bool> UsernameExistsAsync(string normalizedUsername, CancellationToken ct = default);
    Task CreateUserWithCredentialAndSessionAsync(
        UserAccount user,
        UserCredential credential,
        UserSession session,
        CancellationToken ct = default);
    Task<(UserAccount User, UserCredential Credential)?> FindByUsernameAsync(
        string normalizedUsername,
        CancellationToken ct = default);
    Task<UserCredential?> FindCredentialByUidAsync(string userUid, CancellationToken ct = default);
    Task UpdatePasswordHashAsync(string userUid, string newPasswordHash, CancellationToken ct = default);
    Task CreateSessionAsync(UserSession session, CancellationToken ct = default);
    Task<(UserAccount User, UserCredential Credential)?> FindValidSessionAsync(
        string tokenHash,
        DateTime nowUtc,
        CancellationToken ct = default);
    Task RevokeSessionAsync(string tokenHash, CancellationToken ct = default);
}
