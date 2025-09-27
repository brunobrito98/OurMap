import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { PhoneInput } from "@/components/PhoneInput";
import { type Value } from "react-phone-number-input";
import { Megaphone, MapPin, Utensils, Plus, User, Shield, Loader2, ArrowLeft } from "lucide-react";

export default function Landing() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    email: "",
    firstName: "",
    lastName: "",
    phoneNumber: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Redireciona usuários já autenticados para a página inicial
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, authLoading, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleAuth = async (e: React.FormEvent) => {
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
        
        // Get redirect parameter from URL and validate it for security
        const urlParams = new URLSearchParams(window.location.search);
        const redirect = urlParams.get('redirect') || '/';
        // Only allow same-origin relative paths to prevent open-redirect attacks
        const safeRedirect = redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/';
        window.location.href = safeRedirect;
      } else {
        toast({
          title: "Erro",
          description: data.message || "Erro desconhecido",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro de conexão",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-4">
              <MapPin className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold">OurMap</h1>
            <p className="text-muted-foreground mt-2">
              Conecte-se, descubra e viva experiências únicas
            </p>
          </div>

          {/* Hero Features Preview */}
          <div className="bg-white rounded-lg shadow-lg p-6 space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-2">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mx-auto">
                  <Megaphone className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-xs text-muted-foreground">Eventos</p>
              </div>
              <div className="space-y-2">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mx-auto">
                  <MapPin className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-xs text-muted-foreground">Localização</p>
              </div>
              <div className="space-y-2">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mx-auto">
                  <Plus className="w-5 h-5 text-purple-600" />
                </div>
                <p className="text-xs text-muted-foreground">Criar</p>
              </div>
            </div>
          </div>

          {/* Authentication Form */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            {/* Botão para voltar à homepage */}
            <div className="mb-4">
              <button
                onClick={() => navigate("/")}
                className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors bg-transparent border-none p-0 cursor-pointer"
                data-testid="button-back-home"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar ao início
              </button>
            </div>
            <div className="space-y-6">
              <form onSubmit={handleAuth} className="space-y-4">
                {!isRegistering && (
                  <div>
                    <Label htmlFor="username" className="text-sm font-medium">
                      Email, Telefone ou Usuário
                    </Label>
                    <Input
                      id="username"
                      name="username"
                      type="text"
                      value={formData.username}
                      onChange={handleInputChange}
                      required
                      placeholder="Digite seu email, telefone ou nome de usuário"
                      className="mt-1"
                      data-testid="input-username"
                    />
                  </div>
                )}

                {isRegistering && (
                  <>
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

                    <div>
                      <Label htmlFor="phoneNumber" className="text-sm font-medium">
                        Telefone (Opcional)
                      </Label>
                      <PhoneInput
                        value={formData.phoneNumber as Value}
                        onChange={(value) => setFormData({...formData, phoneNumber: value || ""})}
                        placeholder="Digite seu número"
                        className="mt-1"
                        data-testid="input-phone-number"
                      />
                    </div>
                  </>
                )}

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
                  {!isRegistering && (
                    <div className="text-right mt-2">
                      <button
                        type="button"
                        onClick={() => navigate("/forgot-password")}
                        className="text-sm text-primary hover:underline bg-transparent border-none p-0 cursor-pointer"
                        data-testid="button-forgot-password"
                      >
                        Esqueci minha senha
                      </button>
                    </div>
                  )}
                </div>

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
            </div>
          </div>

          {/* Features Preview */}
          <div className="text-center text-sm text-muted-foreground">
            <p>✨ Crie e descubra eventos únicos na sua cidade</p>
          </div>
        </div>
      </div>
    </div>
  );
}