using SmtWms.Domain.Entities;
using SmtWms.Domain.Repositories;

namespace SmtWms.Infrastructure.Persistence;

public sealed class FreeSqlUserRepository(IFreeSql fsql) : IUserRepository
{
    public Task<bool> UsernameExistsAsync(string normalizedUsername, CancellationToken ct = default)
        => fsql.Select<UserCredential>()
            .Where(c => c.Username == normalizedUsername)
            .AnyAsync(ct);

    public async Task CreateUserWithCredentialAndSessionAsync(
        UserAccount user,
        UserCredential credential,
        UserSession session,
        CancellationToken ct = default)
    {
        using var uow = fsql.CreateUnitOfWork();
        var tx = uow.GetOrBeginTransaction();

        user.Id = 0;
        credential.Id = 0;
        session.Id = 0;

        await fsql.Insert(user).WithTransaction(tx).ExecuteAffrowsAsync(ct);
        await fsql.Insert(credential).WithTransaction(tx).ExecuteAffrowsAsync(ct);
        await fsql.Insert(session).WithTransaction(tx).ExecuteAffrowsAsync(ct);

        uow.Commit();
    }

    public async Task<(UserAccount User, UserCredential Credential)?> FindByUsernameAsync(
        string normalizedUsername,
        CancellationToken ct = default)
    {
        var credential = await fsql.Select<UserCredential>()
            .Where(c => c.Username == normalizedUsername)
            .FirstAsync(ct);

        if (credential is null) return null;

        var user = await fsql.Select<UserAccount>()
            .Where(u => u.Uid == credential.UserUid)
            .FirstAsync(ct);

        return user is null ? null : (user, credential);
    }

    public Task<UserCredential?> FindCredentialByUidAsync(string userUid, CancellationToken ct = default)
        => fsql.Select<UserCredential>()
            .Where(c => c.UserUid == userUid)
            .FirstAsync(ct)!;

    public Task UpdatePasswordHashAsync(string userUid, string newPasswordHash, CancellationToken ct = default)
        => fsql.Update<UserCredential>()
            .Set(c => c.PasswordHash, newPasswordHash)
            .Set(c => c.UpdatedAtUtc, DateTime.UtcNow)
            .Where(c => c.UserUid == userUid)
            .ExecuteAffrowsAsync(ct);

    public async Task CreateSessionAsync(UserSession session, CancellationToken ct = default)
    {
        session.Id = 0;
        await fsql.Insert(session).ExecuteAffrowsAsync(ct);
    }

    public async Task<(UserAccount User, UserCredential Credential)?> FindValidSessionAsync(
        string tokenHash,
        DateTime nowUtc,
        CancellationToken ct = default)
    {
        var session = await fsql.Select<UserSession>()
            .Where(s => s.TokenHash == tokenHash && s.ExpiresAtUtc > nowUtc)
            .FirstAsync(ct);

        if (session is null) return null;

        var user = await fsql.Select<UserAccount>()
            .Where(u => u.Uid == session.UserUid)
            .FirstAsync(ct);
        var credential = await fsql.Select<UserCredential>()
            .Where(c => c.UserUid == session.UserUid)
            .FirstAsync(ct);

        return user is null || credential is null ? null : (user, credential);
    }

    public Task RevokeSessionAsync(string tokenHash, CancellationToken ct = default)
        => fsql.Delete<UserSession>()
            .Where(s => s.TokenHash == tokenHash)
            .ExecuteAffrowsAsync(ct);
}
