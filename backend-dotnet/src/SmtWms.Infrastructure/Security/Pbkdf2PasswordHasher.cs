using System.Security.Cryptography;
using System.Text;
using SmtWms.Application.Interfaces;
using SmtWms.Application.Services;

namespace SmtWms.Infrastructure.Security;

public sealed class Pbkdf2PasswordHasher : IPasswordHasher
{
    private const int SaltBytes = 16;
    private const int HashBytes = 64;
    private const int Iterations = 100_000;

    public string HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltBytes);
        var hash = Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(password),
            salt,
            Iterations,
            HashAlgorithmName.SHA512,
            HashBytes);

        return $"pbkdf2${Iterations}${Convert.ToHexString(salt).ToLowerInvariant()}${Convert.ToHexString(hash).ToLowerInvariant()}";
    }

    public bool VerifyPassword(string password, string storedHash)
    {
        if (string.IsNullOrWhiteSpace(storedHash)) return false;
        var parts = storedHash.Split('$');
        if (parts.Length != 4 || !string.Equals(parts[0], "pbkdf2", StringComparison.Ordinal))
            return false;
        if (!int.TryParse(parts[1], out var iterations) || iterations < 10_000)
            return false;

        try
        {
            var salt = Convert.FromHexString(parts[2]);
            var expected = Convert.FromHexString(parts[3]);
            var actual = Rfc2898DeriveBytes.Pbkdf2(
                Encoding.UTF8.GetBytes(password),
                salt,
                iterations,
                HashAlgorithmName.SHA512,
                expected.Length);

            return CryptographicOperations.FixedTimeEquals(actual, expected);
        }
        catch (FormatException)
        {
            return false;
        }
    }

    public string GenerateSessionToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return $"{AuthAppService.SessionTokenPrefix}{Convert.ToHexString(bytes).ToLowerInvariant()}";
    }

    public string HashSessionToken(string token)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
