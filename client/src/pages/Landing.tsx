import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { PhoneInput } from "@/components/PhoneInput";
import { type Value } from "react-phone-number-input";
import { Megaphone, MapPin, Utensils, Plus, Phone, User, Send, Shield, Loader2 } from "lucide-react";

export default function Landing() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [authMode, setAuthMode] = useState<"credentials" | "sms">("credentials");
  const [smsStep, setSmsStep] = useState<"phone" | "verification">("phone");
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    email: "",
    firstName: "",
    lastName: "",
  });
  const [phoneNumber, setPhoneNumber] = useState<Value>();
  const [verificationCode, setVerificationCode] = useState("");
  const [pendingPhone, setPendingPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Redireciona usuários já autenticados para a página inicial
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Mutation para envio de código SMS
  const sendSmsCodeMutation = useMutation({
    mutationFn: async (phone: Value) => {
      return apiRequest('/api/auth/phone/start', 'POST', { phone });
    },
    onSuccess: (_, phone) => {
      setPendingPhone(phone);
      setSmsStep("verification");
      toast({
        title: "Código enviado",
        description: `Enviamos um código de verificação para ${phone}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Erro ao enviar código SMS",
        variant: "destructive",
      });
    },
  });

  // Mutation para verificação de código SMS
  const verifySmsCodeMutation = useMutation({
    mutationFn: async (data: { phone: string; code: string }) => {
      return apiRequest('/api/auth/phone/verify', 'POST', data);
    },
    onSuccess: (data: any) => {
      toast({
        title: "Login realizado!",
        description: `Bem-vindo, ${data?.user?.firstName || data?.firstName || 'usuário'}!`,
      });
      
      // Get redirect parameter from URL and validate it for security
      const urlParams = new URLSearchParams(window.location.search);
      const redirect = urlParams.get('redirect') || '/';
      // Only allow same-origin relative paths to prevent open-redirect attacks
      const safeRedirect = redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/';
      window.location.href = safeRedirect;
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Código de verificação inválido",
        variant: "destructive",
      });
    },
  });


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // Handle SMS phone submission
  const handleSmsPhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) {
      toast({
        title: "Erro",
        description: "Insira um número de telefone válido",
        variant: "destructive",
      });
      return;
    }
    sendSmsCodeMutation.mutate(phoneNumber);
  };

  // Handle SMS verification code submission
  const handleSmsVerificationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode || verificationCode.length !== 6) {
      toast({
        title: "Erro",
        description: "Insira um código de 6 dígitos",
        variant: "destructive",
      });
      return;
    }
    verifySmsCodeMutation.mutate({ 
      phone: pendingPhone, 
      code: verificationCode 
    });
  };

  // Reset SMS flow
  const resetSmsFlow = () => {
    setSmsStep("phone");
    setPhoneNumber(undefined);
    setVerificationCode("");
    setPendingPhone("");
  };

  // Switch auth mode and reset forms
  const switchAuthMode = (mode: "credentials" | "sms") => {
    setAuthMode(mode);
    setIsRegistering(false);
    resetSmsFlow();
    setFormData({
      username: "",
      password: "",
      email: "",
      firstName: "",
      lastName: "",
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
            {authMode === "sms" 
              ? (smsStep === "phone" ? "Entrar com SMS" : "Verificar Código")
              : (isRegistering ? "Criar Conta" : "Entrar")
            }
          </h2>
          
          {/* Auth Mode Tabs */}
          <div className="flex bg-muted rounded-lg p-1 mb-6">
            <button
              type="button"
              onClick={() => switchAuthMode("credentials")}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                authMode === "credentials"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="tab-credentials"
            >
              <User className="w-4 h-4" />
              <span>Usuário</span>
            </button>
            <button
              type="button"
              onClick={() => switchAuthMode("sms")}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                authMode === "sms"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="tab-sms"
            >
              <Phone className="w-4 h-4" />
              <span>SMS</span>
            </button>
          </div>

          {authMode === "credentials" ? (
            // Username/Password Form
            <>
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
            </>
          ) : (
            // SMS Authentication Forms
            <div className="space-y-6">
              {smsStep === "phone" ? (
                // Phone Number Input
                <form onSubmit={handleSmsPhoneSubmit} className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium flex items-center space-x-2">
                      <Phone className="w-4 h-4" />
                      <span>Número de Telefone</span>
                    </Label>
                    <PhoneInput
                      value={phoneNumber}
                      onChange={setPhoneNumber}
                      placeholder="Digite seu número"
                      className="mt-1"
                      data-testid="input-phone-number"
                    />
                    <div className="text-xs text-muted-foreground mt-1">
                      Enviaremos um código de verificação via SMS
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={sendSmsCodeMutation.isPending || !phoneNumber}
                    className="w-full h-12"
                    data-testid="button-send-sms-code"
                  >
                    {sendSmsCodeMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enviando Código...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Enviar Código SMS
                      </>
                    )}
                  </Button>
                </form>
              ) : (
                // Verification Code Input
                <div className="space-y-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-center space-x-2 mb-2">
                      <Shield className="w-5 h-5 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">Código enviado!</span>
                    </div>
                    <p className="text-blue-800 text-sm">
                      Enviamos um código de 6 dígitos para<br />
                      <strong>{pendingPhone}</strong>
                    </p>
                  </div>

                  <form onSubmit={handleSmsVerificationSubmit} className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium flex items-center space-x-2">
                        <Shield className="w-4 h-4" />
                        <span>Código de Verificação</span>
                      </Label>
                      <Input
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        placeholder="123456"
                        maxLength={6}
                        className="mt-1 text-center text-lg tracking-widest"
                        data-testid="input-verification-code"
                      />
                    </div>

                    <div className="space-y-3">
                      <Button
                        type="submit"
                        disabled={verifySmsCodeMutation.isPending || verificationCode.length !== 6}
                        className="w-full h-12"
                        data-testid="button-verify-sms-code"
                      >
                        {verifySmsCodeMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Verificando...
                          </>
                        ) : (
                          <>
                            <Shield className="w-4 h-4 mr-2" />
                            Verificar e Entrar
                          </>
                        )}
                      </Button>

                      <div className="flex space-x-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => sendSmsCodeMutation.mutate(phoneNumber!)}
                          disabled={sendSmsCodeMutation.isPending}
                          className="flex-1"
                          data-testid="button-resend-sms-code"
                        >
                          {sendSmsCodeMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Reenviando...
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4 mr-2" />
                              Reenviar
                            </>
                          )}
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          onClick={resetSmsFlow}
                          className="flex-1"
                          data-testid="button-change-phone"
                        >
                          <Phone className="w-4 h-4 mr-2" />
                          Trocar Número
                        </Button>
                      </div>
                    </div>
                  </form>
                </div>
              )}

              {/* Security Notice for SMS */}
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <h4 className="font-medium text-amber-900 mb-2 text-sm">Aviso de Segurança</h4>
                <ul className="text-xs text-amber-800 space-y-1">
                  <li>• O código tem validade de 10 minutos</li>
                  <li>• Nunca compartilhe seu código de verificação</li>
                  <li>• Se não receber o SMS, verifique se o número está correto</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
