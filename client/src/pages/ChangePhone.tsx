import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/PhoneInput";
import { type Value } from "react-phone-number-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import type { UserWithStats } from "@shared/schema";
import { 
  ArrowLeft, 
  Phone,
  Send,
  Loader2,
  Save,
  Shield,
  CheckCircle,
  AlertCircle
} from "lucide-react";

const phoneSchema = z.object({
  phone: z.string().min(1, "Número de telefone é obrigatório"),
});

const verificationSchema = z.object({
  code: z.string().length(6, "Código deve ter 6 dígitos").regex(/^\d{6}$/, "Código deve conter apenas números"),
});

type PhoneForm = z.infer<typeof phoneSchema>;
type VerificationForm = z.infer<typeof verificationSchema>;

export default function ChangePhone() {
  const [, navigate] = useLocation();
  const { user: authUser } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<"phone" | "verification">("phone");
  const [pendingPhone, setPendingPhone] = useState("");

  const { data: user, isLoading } = useQuery<UserWithStats>({
    queryKey: ['/api/auth/user'],
    enabled: !!authUser,
  });

  const phoneForm = useForm<PhoneForm>({
    resolver: zodResolver(phoneSchema),
    defaultValues: {
      phone: "",
    },
  });

  const verificationForm = useForm<VerificationForm>({
    resolver: zodResolver(verificationSchema),
    defaultValues: {
      code: "",
    },
  });

  // Send verification code mutation
  const sendCodeMutation = useMutation({
    mutationFn: async (data: PhoneForm) => {
      return apiRequest('/api/auth/phone/start', 'POST', data);
    },
    onSuccess: (_, variables) => {
      setPendingPhone(variables.phone);
      setStep("verification");
      toast({
        title: "Código enviado",
        description: `Código de verificação enviado para ${variables.phone}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Erro ao enviar código de verificação",
        variant: "destructive",
      });
    },
  });

  // Verify and update phone mutation
  const verifyPhoneMutation = useMutation({
    mutationFn: async (data: VerificationForm) => {
      return apiRequest('/api/auth/phone/verify', 'POST', {
        phone: pendingPhone,
        code: data.code
      });
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Número de telefone atualizado com sucesso!",
      });
      navigate("/settings/profile");
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Código de verificação inválido",
        variant: "destructive",
      });
    },
  });

  const handleSendCode = (data: PhoneForm) => {
    sendCodeMutation.mutate(data);
  };

  const handleVerifyCode = (data: VerificationForm) => {
    verifyPhoneMutation.mutate(data);
  };

  const handleBackToPhone = () => {
    setStep("phone");
    setPendingPhone("");
    phoneForm.reset();
    verificationForm.reset();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="animate-pulse">
          <div className="h-16 bg-muted border-b"></div>
          <div className="p-4 space-y-4">
            <div className="h-32 bg-muted rounded-2xl"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white border-b border-border p-4 sticky top-0 z-30">
        <div className="flex items-center space-x-4">
          <Button
            onClick={() => step === "phone" ? navigate("/settings/profile") : handleBackToPhone()}
            variant="ghost"
            size="sm"
            data-testid="button-back-change-phone"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="font-semibold text-foreground flex-1">
            {step === "phone" ? "Atualizar Telefone" : "Verificar Código"}
          </h2>
        </div>
      </div>

      <div className="p-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <span>{step === "phone" ? "Novo Número de Telefone" : "Verificação SMS"}</span>
            </CardTitle>
            <CardDescription>
              {step === "phone" ? 
                "Insira seu novo número de telefone para receber um código de verificação via SMS" :
                `Digite o código de 6 dígitos enviado para ${pendingPhone}`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Current Phone Display */}
            {step === "phone" && user?.phoneE164 && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Phone className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Número atual:</span>
                </div>
                <p className="text-blue-800" data-testid="text-current-phone">
                  {user.phoneE164}
                  {user.phoneVerified && (
                    <CheckCircle className="w-4 h-4 text-green-600 inline ml-2" />
                  )}
                </p>
              </div>
            )}

            {step === "phone" ? (
              // Phone Input Step
              <Form {...phoneForm}>
                <form onSubmit={phoneForm.handleSubmit(handleSendCode)} className="space-y-6">
                  <FormField
                    control={phoneForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center space-x-2">
                          <Phone className="w-4 h-4" />
                          <span>Novo Número de Telefone</span>
                        </FormLabel>
                        <FormControl>
                          <PhoneInput
                            value={field.value as Value}
                            onChange={field.onChange}
                            placeholder="Número de telefone"
                            data-testid="input-new-phone"
                          />
                        </FormControl>
                        <div className="text-xs text-muted-foreground">
                          Selecione o país e digite seu número de telefone
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={sendCodeMutation.isPending}
                    data-testid="button-send-code"
                  >
                    {sendCodeMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enviando Código...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Enviar Código de Verificação
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            ) : (
              // Verification Step
              <div className="space-y-6">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Enviamos um código de 6 dígitos para <strong>{pendingPhone}</strong>. 
                    Digite o código abaixo para confirmar a alteração.
                  </AlertDescription>
                </Alert>

                <Form {...verificationForm}>
                  <form onSubmit={verificationForm.handleSubmit(handleVerifyCode)} className="space-y-6">
                    <FormField
                      control={verificationForm.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center space-x-2">
                            <Shield className="w-4 h-4" />
                            <span>Código de Verificação</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="text"
                              placeholder="123456"
                              maxLength={6}
                              className="text-center text-lg tracking-widest"
                              data-testid="input-verification-code"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-3">
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={verifyPhoneMutation.isPending}
                        data-testid="button-verify-code"
                      >
                        {verifyPhoneMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Verificando...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Confirmar e Salvar
                          </>
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => sendCodeMutation.mutate({ phone: pendingPhone })}
                        disabled={sendCodeMutation.isPending}
                        data-testid="button-resend-code"
                      >
                        {sendCodeMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Reenviando...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Reenviar Código
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            )}

            {/* Security Notice */}
            <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
              <h4 className="font-medium text-amber-900 mb-2">Aviso de Segurança</h4>
              <ul className="text-sm text-amber-800 space-y-1">
                <li>• O código tem validade de 10 minutos</li>
                <li>• Nunca compartilhe seu código de verificação</li>
                <li>• Se não receber o SMS, verifique se o número está correto</li>
                <li>• Em caso de problemas, entre em contato com o suporte</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}