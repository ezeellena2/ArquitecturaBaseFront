import { UserManager } from "oidc-client-ts";
import { authConfig } from "@/auth/authConfig";

// Página del iframe de renovación: solo completa el flujo y avisa a la ventana principal.
void new UserManager(authConfig).signinSilentCallback();
