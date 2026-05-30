package com.tariff.backend.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.tariff.backend.dto.UserLoginDTO;
import com.tariff.backend.dto.UserRequestDTO;
import com.tariff.backend.model.User;
import com.tariff.backend.service.JwtService;
import com.tariff.backend.service.UserService;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;

@RestController
@RequestMapping(path = "api/users")
public class UserController {

  private final JwtService jwtService;
  private final UserService userService;

  // Cross-site cookies (Vercel frontend -> Render backend) require Secure + SameSite=None.
  // Local http dev uses secure=false / SameSite=Lax. Driven by env so one build serves both.
  @Value("${app.cookie.secure:false}")
  private boolean cookieSecure;

  @Value("${app.cookie.same-site:Lax}")
  private String cookieSameSite;

  public UserController(UserService userService, JwtService jwtService) {
    this.userService = userService;
    this.jwtService = jwtService;
  }

  @GetMapping("/")
  public List<User> getAllUsers() {
    return userService.listUsers();
  }

  //   Return users with token for testing
  @GetMapping("/me")
  public ResponseEntity<User> authenticatedUser() {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    System.out.println("Authentication object: " + authentication.getPrincipal());
    User currentUser = (User) authentication.getPrincipal();
    return ResponseEntity.ok(currentUser);
  }

  @PostMapping("/register")
  public User registerUser(
    @Valid @RequestBody UserRequestDTO.AddUserDto addUserDto
  ) {
    return userService.addUser(addUserDto);
  }

  @PostMapping("/login")
  public ResponseEntity<UserLoginDTO> loginUser(
    @Valid @RequestBody UserRequestDTO.LoginDto loginDto,
    HttpServletResponse response 
  ) {
    // Note that it takes in the record to auth user and returns seperate mutable DTO
    User authenticatedUser = userService.loginUser(loginDto);
    String jwtToken = jwtService.generateToken(authenticatedUser);

    // ✅ Set auth cookie
    Cookie cookie = new Cookie("auth_token", jwtToken);
    cookie.setHttpOnly(false);       // Frontend reads it (kept as-is)
    cookie.setSecure(cookieSecure);  // Must be true when SameSite=None (cross-site prod)
    cookie.setPath("/");             // Available for all paths
    cookie.setMaxAge(3 * 24 * 60 * 60); // 3 days in seconds
    cookie.setAttribute("SameSite", cookieSameSite); // None for cross-site, Lax for local dev

    response.addCookie(cookie);
    System.out.println("Set cookie in response"); 
    System.out.println(cookie);
    return ResponseEntity.ok(
      new UserLoginDTO(jwtToken, jwtService.getExpirationTime())
    );
  }

  @PutMapping("/change-password")
  public User updatePassword(@AuthenticationPrincipal UserDetails loggedInUser,
                             @Valid @RequestBody UserRequestDTO.UpdatePasswordDto updatePasswordDto) {
      String authenticatedEmail = loggedInUser.getUsername();
      return userService.updatePassword(authenticatedEmail, updatePasswordDto);
  }

  // @PutMapping("/change-email")
  // public User updatePassword(@Valid @RequestBody UserRequestDTO.UpdateEmailDto updateEmailDto) {
  //   return userService.updateEmail(updateEmailDto);
  // }

    @DeleteMapping("/")
    public User deleteUser(@Valid @RequestBody UserRequestDTO.DeleteUserDto deleteUserDto) {
        return userService.deleteUser(deleteUserDto);
    }

    @PutMapping("/upgrade-role")
    public User upgradeRole(@Valid @RequestBody UserRequestDTO.UpdateUserRoleDto updateUserRoleDto) {
      return userService.upgradeRole(updateUserRoleDto);
    }

    @PutMapping("/downgrade-role")
    public User downgradeRole(@Valid @RequestBody UserRequestDTO.UpdateUserRoleDto updateUserRoleDto) {
        return userService.downgradeRole(updateUserRoleDto);
    }

    @PostMapping("/logout")
    public ResponseEntity<String> logout(HttpServletResponse response) {
      // Delete the cookie by setting maxAge to 0.
      // Attributes must match the login cookie so the browser overwrites/clears it cross-site.
      Cookie cookie = new Cookie("auth_token", null);
      cookie.setHttpOnly(false);
      cookie.setSecure(cookieSecure);
      cookie.setPath("/");
      cookie.setMaxAge(0);  // Expire immediately
      cookie.setAttribute("SameSite", cookieSameSite);

      response.addCookie(cookie);
      
      return ResponseEntity.ok("Logged out successfully");
    }
}
