import { Button } from "@/components/ui/button";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
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
          <h1 className="text-4xl font-bold text-white mb-2">EventHub</h1>
          <p className="text-white/80 text-lg">Descubra e organize eventos incríveis</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          <h2 className="text-2xl font-semibold text-foreground mb-6 text-center">Entrar</h2>
          
          {/* Social Login Buttons */}
          <div className="space-y-3 mb-6">
            <Button
              onClick={handleLogin}
              variant="outline"
              className="w-full flex items-center justify-center space-x-3 h-12"
              data-testid="button-login-google"
            >
              <i className="fab fa-google text-xl text-red-500"></i>
              <span className="font-medium">Continuar com Google</span>
            </Button>
            
            <Button
              onClick={handleLogin}
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
            onClick={handleLogin}
            className="w-full bg-primary hover:bg-primary/90 h-12"
            data-testid="button-login-replit"
          >
            Entrar com Replit
          </Button>

          <div className="text-center mt-6">
            <a href="#" className="text-primary text-sm hover:underline">Esqueceu sua senha?</a>
          </div>
          
          <div className="text-center mt-4">
            <span className="text-muted-foreground text-sm">Não tem conta? </span>
            <a href="#" className="text-primary text-sm font-medium hover:underline">Cadastre-se</a>
          </div>
        </div>
      </div>
    </div>
  );
}
