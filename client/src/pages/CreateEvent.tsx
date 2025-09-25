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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import ImageUpload from "@/components/ImageUpload";
import MapComponent from "@/components/MapComponent";
import LocalPlaceSearch from "@/components/LocalPlaceSearch";
import InteractiveMapModal from "@/components/InteractiveMapModal";
import { useToast } from "@/hooks/use-toast";
import { insertEventSchema, type InsertEvent } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { X, Save, Loader2, Gift, Ticket, Heart, Lock, Users, Link, Copy, MapPin, Maximize2 } from "lucide-react";

const categories = [
  { value: "festas", label: "Festas", icon: "fas fa-glass-cheers" },
  { value: "sports", label: "Esportes", icon: "fas fa-running" },
  { value: "corrida", label: "Corrida", icon: "fas fa-running-fast" },
  { value: "volei", label: "Vôlei", icon: "fas fa-volleyball" },
  { value: "ciclismo", label: "Ciclismo", icon: "fas fa-bicycle" },
  { value: "futebol", label: "Futebol", icon: "fas fa-futbol" },
  { value: "tech", label: "Tecnologia", icon: "fas fa-laptop-code" },
  { value: "religioso", label: "Religioso", icon: "fas fa-pray" },
  { value: "motoclube", label: "Encontro de Motoclube", icon: "fas fa-motorcycle" },
  { value: "encontros", label: "Encontros", icon: "fas fa-users" },
  { value: "piquenique", label: "Piquenique", icon: "fas fa-tree" },
  { value: "food", label: "Gastronomia", icon: "fas fa-utensils" },
  { value: "art", label: "Arte", icon: "fas fa-palette" },
  { value: "music", label: "Música", icon: "fas fa-music" },
  { value: "outros", label: "Outros", icon: "fas fa-calendar" },
];

const recurringOptions = [
  { value: "daily", label: "Diariamente" },
  { value: "weekly", label: "Semanalmente" },
  { value: "biweekly", label: "A cada 15 dias" },
  { value: "monthly", label: "Mensalmente" },
];

export default function CreateEvent() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [mapCoordinates, setMapCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [priceType, setPriceType] = useState<"free" | "paid" | "crowdfunding">("free");
  const [isPrivateEvent, setIsPrivateEvent] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [isPlaceSearchOpen, setIsPlaceSearchOpen] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [currentCityName, setCurrentCityName] = useState<string>("");

  const isEditing = !!id;

  // Fetch event data if editing
  const { data: eventData } = useQuery<any>({
    queryKey: ['/api/events', id],
    enabled: isEditing,
  });

  // Fetch friends list for private event invitations
  const { data: friendsList } = useQuery<any[]>({
    queryKey: ['/api/friends'],
    enabled: isPrivateEvent,
  });

  const form = useForm<InsertEvent>({
    resolver: zodResolver(insertEventSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      dateTime: "",
      endTime: "",
      location: "",
      priceType: "free",
      price: "0",
      fundraisingGoal: "",
      minimumContribution: "",
      isRecurring: false,
      recurrenceType: undefined,
      recurrenceEndDate: "",
      iconEmoji: "📅",
      isPrivate: false,
    },
  });

  // Get user's location for proximity search
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(location);
          
          // Get city name for local place search
          fetch('/api/reverse-geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(location),
          })
            .then(res => res.json())
            .then(data => {
              if (data.city) {
                setCurrentCityName(data.city);
              }
            })
            .catch(console.error);
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  }, []);

  // Update form when event data is loaded
  useEffect(() => {
    if (eventData && isEditing) {
      const formatDateTime = (dateTime: string) => {
        const date = new Date(dateTime);
        const offset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - offset);
        return localDate.toISOString().slice(0, 16);
      };

      form.reset({
        title: eventData.title,
        description: eventData.description || "",
        category: eventData.category,
        dateTime: formatDateTime(eventData.dateTime),
        endTime: eventData.endTime ? formatDateTime(eventData.endTime) : "",
        location: eventData.location,
        priceType: eventData.priceType || "free",
        price: eventData.price || "0",
        fundraisingGoal: eventData.fundraisingGoal || "",
        minimumContribution: eventData.minimumContribution || "",
        isRecurring: eventData.isRecurring,
        recurrenceType: eventData.recurrenceType || undefined,
        recurrenceEndDate: eventData.recurrenceEndDate ? formatDateTime(eventData.recurrenceEndDate) : "",
        iconEmoji: eventData.iconEmoji || "📅",
        isPrivate: eventData.isPrivate || false,
      });
      
      // Set priceType state based on event data
      setPriceType(eventData.priceType || "free");
      
      // Set private event state
      setIsPrivateEvent(eventData.isPrivate || false);
      
      setMapCoordinates({
        lat: parseFloat(eventData.latitude),
        lng: parseFloat(eventData.longitude),
      });
    }
  }, [eventData, isEditing, form]);

  // Calculate event duration
  const calculateDuration = (startTime: string, endTime: string) => {
    if (!startTime || !endTime) return "";
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end.getTime() - start.getTime();
    
    if (diffMs <= 0) return "";
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours === 0) {
      return `${minutes} minutos`;
    } else if (minutes === 0) {
      return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    } else {
      return `${hours} ${hours === 1 ? 'hora' : 'horas'} e ${minutes} minutos`;
    }
  };

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
        let errorMessage = isEditing ? "Falha ao atualizar evento" : "Falha ao criar evento";
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // If JSON parsing fails, use default message
        }
        throw new Error(errorMessage);
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all queries that start with '/api/events'
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === '/api/events'
      });
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
        title: "Aviso",
        description: error.message || (isEditing ? "Falha ao atualizar evento" : "Falha ao criar evento"),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertEvent) => {
    const formData = new FormData();
    
    // Append form fields
    formData.append('title', data.title || '');
    // Convert datetime-local string to ISO string with timezone
    const dateTimeWithTimezone = data.dateTime ? new Date(data.dateTime).toISOString() : '';
    formData.append('dateTime', dateTimeWithTimezone);
    
    // Add endTime if provided
    if (data.endTime) {
      const endTimeWithTimezone = new Date(data.endTime).toISOString();
      formData.append('endTime', endTimeWithTimezone);
    }
    
    formData.append('location', data.location || '');
    formData.append('category', data.category || '');
    
    if (data.description) {
      formData.append('description', data.description);
    }
    
    // Handle recurring event fields
    if (data.isRecurring) {
      formData.append('isRecurring', 'true');
      if (data.recurrenceType && data.recurrenceType.trim() !== '') {
        formData.append('recurrenceType', data.recurrenceType);
      }
      // Add recurrence interval (default to 1 if not specified)
      formData.append('recurrenceInterval', data.recurrenceInterval?.toString() || '1');
      // Add recurrence end date
      if (data.recurrenceEndDate) {
        const recurrenceEndDateWithTimezone = new Date(data.recurrenceEndDate).toISOString();
        formData.append('recurrenceEndDate', recurrenceEndDateWithTimezone);
      }
    } else {
      formData.append('isRecurring', 'false');
    }
    
    // Add price type and related fields
    formData.append('priceType', data.priceType || 'free');
    
    // Add price for paid events
    if (data.priceType === 'paid') {
      formData.append('price', data.price || "0");
    } else {
      formData.append('price', "0");
    }
    
    // Add crowdfunding fields
    if (data.priceType === 'crowdfunding') {
      if (data.fundraisingGoal) {
        formData.append('fundraisingGoal', data.fundraisingGoal);
      }
      if (data.minimumContribution) {
        formData.append('minimumContribution', data.minimumContribution);
      }
    }
    
    // Add coordinates if available
    if (mapCoordinates) {
      formData.append('latitude', mapCoordinates.lat.toString());
      formData.append('longitude', mapCoordinates.lng.toString());
    }
    
    // Add private event fields
    formData.append('isPrivate', data.isPrivate ? 'true' : 'false');
    
    // Add invited friends if private event
    if (data.isPrivate && selectedFriends.length > 0) {
      formData.append('invitedFriends', JSON.stringify(selectedFriends));
    }
    
    // Append cover image if selected
    if (coverImage) {
      formData.append('coverImage', coverImage);
    }
    
    createEventMutation.mutate(formData);
  };

  const handleAddressChange = async (address: string) => {
    if (!address) return;
    
    try {
      const requestBody: any = { address };
      if (userLocation) {
        requestBody.proximity = userLocation;
      }
      
      const response = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
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
        form.setValue('location', data.address);
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
    }
  };

  const handleMapModalLocationSelect = (lat: number, lng: number, address?: string) => {
    setMapCoordinates({ lat, lng });
    if (address) {
      form.setValue('location', address);
    }
  };

  const handlePlaceSelect = (place: any) => {
    const [lng, lat] = place.center;
    setMapCoordinates({ lat, lng });
    form.setValue('location', place.address);
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
            <X className="w-5 h-5" />
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
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
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
              
              <FormField
                control={form.control}
                name="dateTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data e Hora de Início *</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                        value={field.value || ""}
                        data-testid="input-datetime"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data e Hora de Fim (opcional)</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                        value={field.value || ""}
                        data-testid="input-endtime"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Duration Display */}
              {form.watch("dateTime") && form.watch("endTime") && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">Duração do evento:</span> {calculateDuration(form.watch("dateTime") || "", form.watch("endTime") || "")}
                  </p>
                </div>
              )}

              {/* Recurring Event Option */}
              <div className="bg-secondary rounded-xl p-4">
                <FormField
                  control={form.control}
                  name="isRecurring"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value || false}
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
                  <div className="mt-3 space-y-3">
                    <FormField
                      control={form.control}
                      name="recurrenceType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Frequência da Recorrência *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger data-testid="select-recurrence-type">
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

                    <FormField
                      control={form.control}
                      name="recurrenceEndDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Repetir até quando? *</FormLabel>
                          <FormControl>
                            <Input
                              type="datetime-local"
                              {...field}
                              value={field.value || ""}
                              data-testid="input-recurrence-end-date"
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            Define até quando os eventos recorrentes serão criados
                          </p>
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
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: Parque Ibirapuera, São Paulo - SP"
                        {...field}
                        value={field.value || ""}
                        onBlur={() => handleAddressChange(field.value)}
                        data-testid="input-location"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      As coordenadas serão detectadas automaticamente
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Local Place Search Button */}
              {userLocation && currentCityName && (
                <div className="flex items-center justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsPlaceSearchOpen(true)}
                    className="flex items-center gap-2"
                    data-testid="button-search-local-places"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Buscar Lugares em {currentCityName}
                  </Button>
                </div>
              )}

              {/* Interactive Map for Pin Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Localização no Mapa</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsMapModalOpen(true)}
                    className="flex items-center gap-2"
                    data-testid="button-open-map-modal"
                  >
                    <Maximize2 className="w-4 h-4" />
                    Abrir Mapa Completo
                  </Button>
                </div>
                
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
                  Clique ou arraste o pin para definir localização exata, ou use o botão "Abrir Mapa Completo" para uma melhor visualização
                </p>
              </div>
            </div>

            {/* Privacy Section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Privacidade do Evento</h3>
              
              <div className="bg-secondary rounded-xl p-4">
                <FormField
                  control={form.control}
                  name="isPrivate"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value || false}
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                            setIsPrivateEvent(!!checked);
                          }}
                          data-testid="checkbox-private"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="flex items-center space-x-2">
                          <Lock className="w-4 h-4" />
                          <span>Evento Privado</span>
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Apenas pessoas convidadas poderão ver e participar do evento
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
                
                {isPrivateEvent && (
                  <div className="mt-4 space-y-4">
                    {/* Link Secreto Info */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center space-x-2 mb-2">
                        <Link className="w-4 h-4 text-blue-600" />
                        <h4 className="font-medium text-blue-800">Link Secreto</h4>
                      </div>
                      <p className="text-sm text-blue-700 mb-2">
                        Um link único será gerado automaticamente para compartilhar com pessoas específicas.
                      </p>
                      <p className="text-xs text-blue-600">
                        💡 Você poderá copiar e compartilhar o link após criar o evento
                      </p>
                    </div>

                    {/* Friends Selection */}
                    <div>
                      <label className="flex items-center space-x-2 text-sm font-medium text-foreground mb-3">
                        <Users className="w-4 h-4" />
                        <span>Convidar Amigos</span>
                      </label>
                      
                      {friendsList && friendsList.length > 0 ? (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {friendsList.map((friend: any) => (
                            <div key={friend.id} className="flex items-center space-x-3 p-2 bg-white rounded-lg border">
                              <Checkbox
                                id={`friend-${friend.id}`}
                                checked={selectedFriends.includes(friend.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedFriends(prev => [...prev, friend.id]);
                                  } else {
                                    setSelectedFriends(prev => prev.filter(id => id !== friend.id));
                                  }
                                }}
                                data-testid={`checkbox-friend-${friend.id}`}
                              />
                              <div className="flex items-center space-x-2 flex-1">
                                {friend.profileImageUrl ? (
                                  <img
                                    src={friend.profileImageUrl}
                                    alt={friend.firstName}
                                    className="w-8 h-8 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                                    <Users className="w-4 h-4 text-gray-600" />
                                  </div>
                                )}
                                <label 
                                  htmlFor={`friend-${friend.id}`}
                                  className="text-sm font-medium cursor-pointer"
                                >
                                  {friend.firstName} {friend.lastName}
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground">
                          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Nenhum amigo encontrado</p>
                          <p className="text-xs">Adicione amigos para poder convidá-los</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Ticket Type Section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Tipo de Ingresso</h3>
              
              <div className="bg-secondary rounded-xl p-4">
                <div className="space-y-4">
                  <RadioGroup
                    value={priceType}
                    onValueChange={(value: "free" | "paid" | "crowdfunding") => {
                      setPriceType(value);
                      form.setValue("priceType", value);
                      if (value === "free") {
                        form.setValue("price", "0");
                        form.setValue("fundraisingGoal", "");
                        form.setValue("minimumContribution", "");
                      } else if (value === "paid") {
                        form.setValue("fundraisingGoal", "");
                        form.setValue("minimumContribution", "");
                      } else if (value === "crowdfunding") {
                        form.setValue("price", "0");
                      }
                    }}
                    className="space-y-3"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="free" id="free" data-testid="radio-free" />
                      <Label htmlFor="free" className="flex items-center space-x-2 cursor-pointer">
                        <Gift className="w-5 h-5 text-green-600" />
                        <span>Evento Gratuito</span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="paid" id="paid" data-testid="radio-paid" />
                      <Label htmlFor="paid" className="flex items-center space-x-2 cursor-pointer">
                        <Ticket className="w-5 h-5 text-blue-600" />
                        <span>Evento Pago</span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="crowdfunding" id="crowdfunding" data-testid="radio-crowdfunding" />
                      <Label htmlFor="crowdfunding" className="flex items-center space-x-2 cursor-pointer">
                        <Heart className="w-5 h-5 text-pink-600" />
                        <span>Vaquinha</span>
                      </Label>
                    </div>
                  </RadioGroup>
                  
                  {/* Price field - only show when paid is selected */}
                  {priceType === "paid" && (
                    <div className="mt-4">
                      <FormField
                        control={form.control}
                        name="price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Preço do Ingresso (R$) *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0.01"
                                placeholder="Ex: 25.00"
                                {...field}
                                value={field.value || ""}
                                data-testid="input-price"
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                              Digite o valor do ingresso em reais
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* Crowdfunding fields - only show when crowdfunding is selected */}
                  {priceType === "crowdfunding" && (
                    <div className="mt-4 space-y-4">
                      <FormField
                        control={form.control}
                        name="fundraisingGoal"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Meta de Arrecadação (R$) *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="1"
                                placeholder="Ex: 2000.00"
                                {...field}
                                value={field.value || ""}
                                data-testid="input-fundraising-goal"
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                              Valor total estimado para que o evento aconteça
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="minimumContribution"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Valor Mínimo por Contribuição (R$)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0.01"
                                placeholder="Ex: 10.00 (opcional)"
                                {...field}
                                value={field.value || ""}
                                data-testid="input-minimum-contribution"
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                              Valor mínimo para garantir a seriedade dos apoios (opcional)
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

          </form>
        </Form>
      </div>

      {/* Local Place Search Modal */}
      <LocalPlaceSearch
        open={isPlaceSearchOpen}
        onOpenChange={setIsPlaceSearchOpen}
        onPlaceSelect={handlePlaceSelect}
        userLocation={userLocation}
        currentCity={currentCityName}
      />

      {/* Interactive Map Modal */}
      <InteractiveMapModal
        open={isMapModalOpen}
        onOpenChange={setIsMapModalOpen}
        onLocationSelect={handleMapModalLocationSelect}
        initialLat={mapCoordinates?.lat || userLocation?.lat || -23.5505}
        initialLng={mapCoordinates?.lng || userLocation?.lng || -46.6333}
        initialAddress={form.watch('location') || ''}
      />
    </div>
  );
}
