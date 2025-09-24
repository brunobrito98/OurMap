import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Megaphone, MapPin, Utensils, Plus } from "lucide-react";

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
          <div className="w-32 h-32 mx-auto mb-4 bg-gradient-to-br from-orange-500 via-red-500 to-red-600 rounded-2xl shadow-lg flex flex-col items-center justify-center relative overflow-hidden">
            {/* Smiley face pattern with icons */}
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Top icon (megaphone) */}
              <div className="absolute top-2 left-1/2 transform -translate-x-1/2">
                <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                  <Megaphone className="w-3 h-3 text-orange-500" />
                </div>
              </div>
              
              {/* Left icon (utensils) */}
              <div className="absolute left-2 top-1/2 transform -translate-y-1/2">
                <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                  <Utensils className="w-3 h-3 text-orange-500" />
                </div>
              </div>
              
              {/* Right icon (plus) */}
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                  <Plus className="w-3 h-3 text-orange-500" />
                </div>
              </div>
              
              {/* Center icon (map pin) */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-orange-500" />
                </div>
              </div>
              
              {/* Curved smile lines */}
              <div className="absolute top-6 left-6 w-4 h-1 bg-white rounded-full transform rotate-12"></div>
              <div className="absolute top-6 right-6 w-4 h-1 bg-white rounded-full transform -rotate-12"></div>
              <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-white rounded-full"></div>
            </div>
            
            {/* OurMap text */}
            <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2">
              <span className="text-white text-xs font-bold tracking-wide">OurMap</span>
            </div>
          </div>
          
          {/* Tagline */}
          <p className="text-white/90 text-sm font-medium mt-2">
            Descubra e organize
            <br />
            eventos incríveis
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          <h2 className="text-2xl font-semibold text-foreground mb-6 text-center">
            {isRegistering ? "Criar Conta" : "Entrar"}
          </h2>
          
            {/* Auth Form */}
              <form onSubmit={handleAuth} className="space-y-4">
                {!isRegistering && (
                  <div>
                    <Label htmlFor="username" className="text-sm font-medium">
                      Email ou Usuário
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
    </div>
  );
}
