import { forwardRef } from "react";
import PhoneNumberInput, { type Value } from "react-phone-number-input";
import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import "react-phone-number-input/style.css";

interface PhoneInputProps {
  value?: Value;
  onChange?: (value?: Value) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  defaultCountry?: string;
  error?: boolean;
}

// Move inputComponent outside of render to prevent recreation on each render
const CustomInputComponent = forwardRef<HTMLInputElement, any>((props, ref) => (
  <input
    {...props}
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
    )}
  />
));

CustomInputComponent.displayName = "CustomInputComponent";

const PhoneInput = forwardRef<any, PhoneInputProps>(
  ({ value, onChange, placeholder = "Número de telefone", disabled, className, defaultCountry = "BR", error, ...props }, ref) => {
    return (
      <div className={cn("relative", className)}>
        <PhoneNumberInput
          value={value}
          onChange={onChange || (() => {})}
          placeholder={placeholder}
          defaultCountry={defaultCountry as any}
          disabled={disabled}
          international
          countryCallingCodeEditable={false}
          className={cn(
            "phone-input-custom",
            error && "border-destructive focus-visible:ring-destructive"
          )}
          inputComponent={CustomInputComponent}
          {...props}
        />
        <Phone className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      </div>
    );
  }
);

PhoneInput.displayName = "PhoneInput";

export { PhoneInput };