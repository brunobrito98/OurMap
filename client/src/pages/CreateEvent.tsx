import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import ImageUpload from "@/components/ImageUpload";
import MapComponent from "@/components/MapComponent";
import { useToast } from "@/hooks/use-toast";
import { insertEventSchema, type InsertEvent } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

const categories = [
  { value: "music", label: "Música", icon: "fas fa-music" },
  { value: "food", label: "Gastronomia", icon: "fas fa-utensils" },
  { value: "sports", label: "Esportes", icon: "fas fa-running" },
  { value: "art", label: "Arte", icon: "fas fa-palette" },
  { value: "tech", label: "Tecnologia", icon: "fas fa-laptop-code" },
  { value: "other", label: "Outros", icon: "fas fa-calendar" },
];

const recurringOptions = [
  { value: "weekly", label: "Toda semana" },
  { value: "monthly", label: "Todo mês" },
  { value: "yearly", label: "Todo ano" },
];

export default function CreateEvent() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [mapCoordinates, setMapCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  const isEditing = !!id;

  // Fetch event data if editing
  const { data: eventData } = useQuery<any>({
    queryKey: ['/api/events', id],
    enabled: isEditing,
  });

  const form = useForm<InsertEvent>({
    resolver: zodResolver(insertEventSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      address: "",
      isFree: true,
      price: "0",
      allowRsvp: true,
      isRecurring: false,
      iconType: "calendar",
    },
  });

  // Update form when event data is loaded
  useEffect(() => {
    if (eventData && isEditing) {
      form.reset({
        title: eventData.title,
        description: eventData.description || "",
        category: eventData.category,
        startDate: new Date(eventData.startDate).toISOString().slice(0, 16),
        endDate: eventData.endDate ? new Date(eventData.endDate).toISOString().slice(0, 16) : undefined,
        address: eventData.address,
        price: eventData.price || "0",
        isFree: eventData.isFree,
        allowRsvp: eventData.allowRsvp,
        isRecurring: eventData.isRecurring,
        recurringType: eventData.recurringType || undefined,
        iconType: eventData.iconType || "calendar",
      });
      
      setMapCoordinates({
        lat: eventData.latitude,
        lng: eventData.longitude,
      });
    }
  }, [eventData, isEditing, form]);

  const createEventMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const url = isEditing ? `/api/events/${id}` : '/api/events';
      const method = isEditing ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        body: data,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      toast({
        title: "Sucesso",
        description: isEditing ? "Evento atualizado com sucesso!" : "Evento criado com sucesso!",
      });
      navigate("/");
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Erro",
        description: isEditing ? "Falha ao atualizar evento" : "Falha ao criar evento",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertEvent) => {
    const formData = new FormData();
    
    // Append all form fields
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value.toString());
      }
    });
    
    // Append cover image if selected
    if (coverImage) {
      formData.append('coverImage', coverImage);
    }
    
    createEventMutation.mutate(formData);
  };

  const handleAddressChange = async (address: string) => {
    if (!address) return;
    
    try {
      const response = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      
      if (response.ok) {
        const coordinates = await response.json();
        setMapCoordinates(coordinates);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    }
  };

  const handleMapClick = async (lat: number, lng: number) => {
    setMapCoordinates({ lat, lng });
    
    // Reverse geocode to update address
    try {
      const response = await fetch('/api/reverse-geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
      });
      
      if (response.ok) {
        const data = await response.json();
        form.setValue('address', data.address);
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white border-b border-border p-4 sticky top-0 z-30">
        <div className="flex items-center space-x-4">
          <Button
            onClick={() => navigate("/")}
            variant="ghost"
            size="sm"
            data-testid="button-cancel"
          >
            <i className="fas fa-times text-xl"></i>
          </Button>
          <h2 className="font-semibold text-foreground flex-1">
            {isEditing ? "Editar Evento" : "Criar Evento"}
          </h2>
          <Button
            onClick={form.handleSubmit(onSubmit)}
            disabled={createEventMutation.isPending}
            className="flex items-center space-x-2"
            data-testid="button-save"
          >
            {createEventMutation.isPending ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <i className="fas fa-save"></i>
                <span>Salvar</span>
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="pb-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 space-y-6">
            {/* Cover Image Upload */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Foto de Capa
              </label>
              <ImageUpload
                onImageSelect={setCoverImage}
                currentImageUrl={isEditing ? eventData?.coverImageUrl : undefined}
              />
            </div>

            {/* Basic Info */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Evento *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: Festival de Jazz ao Ar Livre"
                        {...field}
                        data-testid="input-title"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descreva seu evento..."
                        rows={4}
                        {...field}
                        value={field.value || ""}
                        data-testid="input-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-category">
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            <div className="flex items-center space-x-2">
                              <i className={`${category.icon} text-sm`}></i>
                              <span>{category.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Date and Time */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Data e Horário</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data e Hora de Início *</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          data-testid="input-start-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data e Hora de Término</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          data-testid="input-end-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Recurring Event Option */}
              <div className="bg-secondary rounded-xl p-4">
                <FormField
                  control={form.control}
                  name="isRecurring"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-recurring"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Este é um evento recorrente?</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
                
                {form.watch("isRecurring") && (
                  <div className="mt-3">
                    <FormField
                      control={form.control}
                      name="recurringType"
                      render={({ field }) => (
                        <FormItem>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-recurring-type">
                                <SelectValue placeholder="Selecione a frequência" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {recurringOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Location */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Localização</h3>
              
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: Parque Ibirapuera, São Paulo - SP"
                        {...field}
                        onBlur={() => handleAddressChange(field.value)}
                        data-testid="input-address"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      As coordenadas serão detectadas automaticamente
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Interactive Map for Pin Selection */}
              <div className="rounded-xl overflow-hidden">
                <MapComponent
                  latitude={mapCoordinates?.lat || -23.5505}
                  longitude={mapCoordinates?.lng || -46.6333}
                  height={192}
                  showMarker
                  draggableMarker
                  onMarkerDrag={handleMapClick}
                  onClick={handleMapClick}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Clique ou arraste o pin para definir localização exata
              </p>
            </div>

            {/* Pricing */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Preço</h3>
              
              <FormField
                control={form.control}
                name="isFree"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <FormControl>
                        <input
                          type="radio"
                          checked={field.value === true}
                          onChange={() => field.onChange(true)}
                          className="text-primary focus:ring-ring"
                          data-testid="radio-free"
                        />
                      </FormControl>
                      <FormLabel>Gratuito</FormLabel>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <FormControl>
                        <input
                          type="radio"
                          checked={field.value === false}
                          onChange={() => field.onChange(false)}
                          className="text-primary focus:ring-ring"
                          data-testid="radio-paid"
                        />
                      </FormControl>
                      <FormLabel>Pago</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
              
              {!form.watch("isFree") && (
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-muted-foreground">R$</span>
                          <Input
                            type="number"
                            placeholder="0,00"
                            step="0.01"
                            min="0"
                            {...field}
                            data-testid="input-price"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Attendance Settings */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Configurações</h3>
              
              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="allowRsvp"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Permitir confirmação de presença</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Usuários podem confirmar que vão ao evento
                        </p>
                      </div>
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-allow-rsvp"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
