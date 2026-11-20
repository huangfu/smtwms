namespace SmtWms.Application.Interfaces;

public interface IPasswordHasher
{
    string HashPassword(string password);
    bool VerifyPassword(string password, string storedHash);
    string GenerateSessionToken();
    string HashSessionToken(string token);
}
