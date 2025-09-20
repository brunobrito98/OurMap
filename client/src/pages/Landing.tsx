import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Landing() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [showLocalAuth, setShowLocalAuth] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    email: "",
    firstName: "",
    lastName: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSocialLogin = () => {
    window.location.href = "/api/login";
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleLocalAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const endpoint = isRegistering ? "/api/auth/register" : "/api/auth/login";
      const payload = isRegistering ? formData : {
        username: formData.username,
        password: formData.password,
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: isRegistering ? "Cadastro realizado!" : "Login realizado!",
          description: `Bem-vindo, ${data.firstName || data.username}!`,
        });
        window.location.href = "/";
      } else {
        toast({
          title: "Erro",
          description: data.message || "Algo deu errado",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro de conexão. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-br from-primary via-accent to-primary p-6">
      {/* Modern geometric background with circles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-white/10 rounded-full"></div>
        <div className="absolute top-40 -left-16 w-32 h-32 bg-white/10 rounded-full"></div>
        <div className="absolute -bottom-16 left-1/3 w-28 h-28 bg-white/10 rounded-full"></div>
      </div>
      
      <div className="relative z-10 w-full max-w-sm">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <i className="fas fa-calendar-alt text-3xl text-primary"></i>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">OurMap</h1>
          <p className="text-white/80 text-lg">Descubra e organize eventos incríveis</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          <h2 className="text-2xl font-semibold text-foreground mb-6 text-center">
            {showLocalAuth ? (isRegistering ? "Criar Conta" : "Entrar") : "Entrar"}
          </h2>
          
          {!showLocalAuth ? (
            <>
              {/* Social Login Buttons */}
              <div className="space-y-3 mb-6">
                <Button
                  onClick={handleSocialLogin}
                  variant="outline"
                  className="w-full flex items-center justify-center space-x-3 h-12"
                  data-testid="button-login-google"
                >
                  <i className="fab fa-google text-xl text-red-500"></i>
                  <span className="font-medium">Continuar com Google</span>
                </Button>
                
                <Button
                  onClick={handleSocialLogin}
                  className="w-full flex items-center justify-center space-x-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 h-12"
                  data-testid="button-login-instagram"
                >
                  <i className="fab fa-instagram text-xl"></i>
                  <span className="font-medium">Continuar com Instagram</span>
                </Button>
              </div>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-muted-foreground">ou</span>
                </div>
              </div>

              {/* Replit Auth Button */}
              <Button
                onClick={handleSocialLogin}
                className="w-full flex items-center justify-center space-x-3 bg-primary hover:bg-primary/90 h-12"
                data-testid="button-login-replit"
              >
                <i className="fas fa-code text-xl"></i>
                <span className="font-medium">Entrar com Replit</span>
              </Button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-muted-foreground">ou</span>
                </div>
              </div>

              {/* Local Auth Option */}
              <Button
                onClick={() => setShowLocalAuth(true)}
                variant="outline"
                className="w-full flex items-center justify-center space-x-3 h-12"
                data-testid="button-login-local"
              >
                <i className="fas fa-user text-xl"></i>
                <span className="font-medium">Entrar com usuário e senha</span>
              </Button>
            </>
          ) : (
            <>
              {/* Local Auth Form */}
              <form onSubmit={handleLocalAuth} className="space-y-4">
                <div>
                  <Label htmlFor="username" className="text-sm font-medium">
                    Usuário
                  </Label>
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    value={formData.username}
                    onChange={handleInputChange}
                    required
                    className="mt-1"
                    data-testid="input-username"
                  />
                </div>

                <div>
                  <Label htmlFor="password" className="text-sm font-medium">
                    Senha
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    className="mt-1"
                    data-testid="input-password"
                  />
                </div>

                {isRegistering && (
                  <>
                    <div>
                      <Label htmlFor="email" className="text-sm font-medium">
                        Email
                      </Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        className="mt-1"
                        data-testid="input-email"
                      />
                    </div>

                    <div>
                      <Label htmlFor="firstName" className="text-sm font-medium">
                        Nome
                      </Label>
                      <Input
                        id="firstName"
                        name="firstName"
                        type="text"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        required
                        className="mt-1"
                        data-testid="input-firstName"
                      />
                    </div>

                    <div>
                      <Label htmlFor="lastName" className="text-sm font-medium">
                        Sobrenome
                      </Label>
                      <Input
                        id="lastName"
                        name="lastName"
                        type="text"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        required
                        className="mt-1"
                        data-testid="input-lastName"
                      />
                    </div>
                  </>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12"
                  data-testid="button-submit-local"
                >
                  {isLoading ? (
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                  ) : null}
                  {isRegistering ? "Criar Conta" : "Entrar"}
                </Button>
              </form>

              <div className="text-center mt-6">
                <button
                  onClick={() => setIsRegistering(!isRegistering)}
                  className="text-primary text-sm font-medium hover:underline bg-transparent border-none p-0 cursor-pointer"
                  data-testid="button-toggle-register"
                >
                  {isRegistering
                    ? "Já tem conta? Entrar"
                    : "Não tem conta? Cadastre-se"}
                </button>
              </div>

              <div className="text-center mt-4">
                <button
                  onClick={() => setShowLocalAuth(false)}
                  className="text-muted-foreground text-sm hover:underline bg-transparent border-none p-0 cursor-pointer"
                  data-testid="button-back-social"
                >
                  ← Voltar para outras opções
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
