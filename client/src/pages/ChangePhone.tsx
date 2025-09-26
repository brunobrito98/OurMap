import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/PhoneInput";
import { type Value } from "react-phone-number-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { UserWithStats } from "@shared/schema";
import { 
  ArrowLeft, 
  Phone,
  Save,
  CheckCircle
} from "lucide-react";

const phoneSchema = z.object({
  phoneNumber: z.string().optional(),
});

type PhoneForm = z.infer<typeof phoneSchema>;

export default function ChangePhone() {
  const [, navigate] = useLocation();
  const { user: authUser } = useAuth();
  const { toast } = useToast();

  const { data: user, isLoading } = useQuery<UserWithStats>({
    queryKey: ['/api/auth/user'],
    enabled: !!authUser,
  });

  const phoneForm = useForm<PhoneForm>({
    resolver: zodResolver(phoneSchema),
    defaultValues: {
      phoneNumber: "",
    },
  });

  // Update form when user data loads
  useEffect(() => {
    if (user) {
      phoneForm.reset({
        phoneNumber: user.phoneE164 || "",
      });
    }
  }, [user?.phoneE164, phoneForm]);

  // Update phone mutation (simplified without SMS verification)
  const updatePhoneMutation = useMutation({
    mutationFn: async (data: PhoneForm) => {
      return apiRequest('/api/user/profile', 'PATCH', {
        phoneNumber: data.phoneNumber || null
      });
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Número de telefone atualizado com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      navigate("/settings/profile");
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Erro ao atualizar número de telefone",
        variant: "destructive",
      });
    },
  });

  const handleUpdatePhone = (data: PhoneForm) => {
    updatePhoneMutation.mutate(data);
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
            onClick={() => navigate("/settings/profile")}
            variant="ghost"
            size="sm"
            data-testid="button-back-change-phone"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="font-semibold text-foreground flex-1">
            Atualizar Telefone
          </h2>
        </div>
      </div>

      <div className="p-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Phone className="w-5 h-5 text-blue-600" />
              <span>Número de Telefone</span>
            </CardTitle>
            <CardDescription>
              Atualize seu número de telefone. Este campo é opcional e pode ser deixado em branco.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Current Phone Display */}
            {user?.phoneE164 && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Phone className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Número atual:</span>
                </div>
                <p className="text-blue-800" data-testid="text-current-phone">
                  {user.phoneE164}
                  <CheckCircle className="w-4 h-4 text-green-600 inline ml-2" />
                </p>
              </div>
            )}

            <Form {...phoneForm}>
              <form onSubmit={phoneForm.handleSubmit(handleUpdatePhone)} className="space-y-6">
                <FormField
                  control={phoneForm.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium flex items-center space-x-2">
                        <Phone className="w-4 h-4" />
                        <span>Novo Número de Telefone</span>
                      </FormLabel>
                      <FormControl>
                        <PhoneInput
                          value={field.value as Value}
                          onChange={field.onChange}
                          placeholder="Digite seu número ou deixe em branco"
                          className="mt-1"
                          data-testid="input-phone-number"
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground">
                        Campo opcional. Você pode deixar em branco se não quiser fornecer um número.
                      </p>
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={updatePhoneMutation.isPending}
                  className="w-full h-12"
                  data-testid="button-update-phone"
                >
                  {updatePhoneMutation.isPending ? (
                    <>
                      <Save className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Salvar Número
                    </>
                  )}
                </Button>
              </form>
            </Form>

            {/* Info Box */}
            <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
              <h4 className="font-medium text-green-900 mb-2 text-sm">Informação</h4>
              <ul className="text-xs text-green-800 space-y-1">
                <li>• O telefone é um campo opcional no seu perfil</li>
                <li>• Você pode atualizar ou remover seu número a qualquer momento</li>
                <li>• Não é necessária verificação por SMS</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}