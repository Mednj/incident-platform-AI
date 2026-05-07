package com.example.incidents.auth;

import com.example.incidents.security.JwtTokenService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final JwtTokenService tokenService;

    public AuthController(JwtTokenService tokenService) {
        this.tokenService = tokenService;
    }

    @PostMapping("/login")
    public LoginResponse login(@RequestBody LoginRequest request) {
        DemoUser user = DemoUser.find(request.email(), request.password());
        if (user == null) {
            throw new UnauthorizedException();
        }
        String token = tokenService.issue(user.email(), user.roles());
        return new LoginResponse(token, user.email(), user.displayName(), user.roles());
    }

    public record LoginRequest(String email, String password) {
    }

    public record LoginResponse(String token, String email, String displayName, List<String> roles) {
    }

    private record DemoUser(String email, String password, String displayName, List<String> roles) {
        private static final Map<String, DemoUser> USERS = Map.of(
                "dev@example.com", new DemoUser("dev@example.com", "password", "Demo Developer", List.of("DEVELOPER")),
                "admin@example.com", new DemoUser("admin@example.com", "password", "Platform Admin", List.of("ADMIN", "DEVELOPER"))
        );

        private static DemoUser find(String email, String password) {
            DemoUser user = USERS.get(email == null ? "" : email.toLowerCase());
            return user != null && user.password().equals(password) ? user : null;
        }
    }

    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    private static class UnauthorizedException extends RuntimeException {
    }
}

