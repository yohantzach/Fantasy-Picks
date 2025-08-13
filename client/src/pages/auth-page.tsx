import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, type InsertUser } from "@shared/schema";
import { z } from "zod";
import { Loader2, Volleyball, Trophy, DollarSign, Target, Zap } from "lucide-react";
import { PoliciesModal } from "@/components/ui/policies-modal";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

type LoginData = z.infer<typeof loginSchema>;

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const loginForm = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const registerForm = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      email: "",
      password: "",
      name: "",
      phone: "",
      age: 18,
      gender: "male",
    },
  });

  // Redirect if already logged in (after hooks)
  if (user) {
    return <Redirect to="/" />;
  }

  const handleLogin = (data: LoginData) => {
    loginMutation.mutate(data);
  };

  const handleRegister = (data: InsertUser) => {
    registerMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-fpl-purple via-purple-900 to-fpl-purple">
      <div className="flex flex-col lg:flex-row min-h-screen">
        {/* Mobile Logo - Shows at top on mobile only */}
        <div className="lg:hidden flex justify-center pt-8 pb-4">
          <img 
            src="/fantasy_logo.jpg" 
            alt="Fantasy Picks Logo" 
            className="h-16 sm:h-20 w-auto"
          />
        </div>
        
        {/* Left side - Form */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
          <Card className="w-full max-w-md glass-card border-white/20">
            <CardHeader className="text-center px-4 sm:px-6 py-4 sm:py-6">
              <CardTitle className="text-xl sm:text-2xl font-bold text-white">
                {isLogin ? "Welcome Back" : "Join Fantasy Picks"}
              </CardTitle>
              <p className="text-sm sm:text-base text-white/70 mt-2">
                {isLogin ? "Sign in to manage your team" : "Create your account to start playing"}
              </p>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-4 sm:space-y-6">
              {isLogin ? (
                <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4 sm:space-y-5">
                  <div>
                    <Label htmlFor="email" className="text-white">Email</Label>
                    <Input
                      {...loginForm.register("email")}
                      type="email"
                      placeholder="Enter your email"
                      className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:ring-fpl-green focus:border-fpl-green"
                    />
                    {loginForm.formState.errors.email && (
                      <p className="text-red-400 text-sm mt-1">
                        {loginForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="password" className="text-white">Password</Label>
                    <Input
                      {...loginForm.register("password")}
                      type="password"
                      placeholder="Enter your password"
                      className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:ring-fpl-green focus:border-fpl-green"
                    />
                    {loginForm.formState.errors.password && (
                      <p className="text-red-400 text-sm mt-1">
                        {loginForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>
                  
                  <Button
                    type="submit"
                    className="w-full bg-fpl-green hover:bg-green-600 text-white"
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Sign In
                  </Button>
                  
                  {/* Terms and Conditions link for login */}
                  <div className="text-center mt-4">
                    <p className="text-white/70 text-xs">
                      By signing in, you agree to our{" "}
                      <PoliciesModal 
                        trigger={
                          <button type="button" className="text-fpl-green hover:text-green-400 underline font-medium">
                            Terms & Conditions and Privacy Policy
                          </button>
                        }
                      />
                    </p>
                  </div>
                </form>
              ) : (
                <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
                  <div>
                    <Label htmlFor="name" className="text-white">Full Name</Label>
                    <Input
                      {...registerForm.register("name")}
                      placeholder="Enter your name"
                      className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:ring-fpl-green focus:border-fpl-green"
                    />
                    {registerForm.formState.errors.name && (
                      <p className="text-red-400 text-sm mt-1">
                        {registerForm.formState.errors.name.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-white">Email</Label>
                    <Input
                      {...registerForm.register("email")}
                      type="email"
                      placeholder="Enter your email"
                      className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:ring-fpl-green focus:border-fpl-green"
                    />
                    {registerForm.formState.errors.email && (
                      <p className="text-red-400 text-sm mt-1">
                        {registerForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="phone" className="text-white">Phone Number</Label>
                    <Input
                      {...registerForm.register("phone")}
                      type="tel"
                      placeholder="Enter your phone number"
                      className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:ring-fpl-green focus:border-fpl-green"
                    />
                    {registerForm.formState.errors.phone && (
                      <p className="text-red-400 text-sm mt-1">
                        {registerForm.formState.errors.phone.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="password" className="text-white">Password</Label>
                    <Input
                      {...registerForm.register("password")}
                      type="password"
                      placeholder="Create a password (min. 6 characters)"
                      className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:ring-fpl-green focus:border-fpl-green"
                    />
                    {registerForm.formState.errors.password && (
                      <p className="text-red-400 text-sm mt-1">
                        {registerForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="age" className="text-white">Age</Label>
                      <Input
                        {...registerForm.register("age", { valueAsNumber: true })}
                        type="number"
                        placeholder="Age"
                        className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:ring-fpl-green focus:border-fpl-green"
                      />
                      {registerForm.formState.errors.age && (
                        <p className="text-red-400 text-sm mt-1">
                          {registerForm.formState.errors.age.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="gender" className="text-white">Gender</Label>
                      <Select onValueChange={(value) => registerForm.setValue("gender", value as "male" | "female" | "other")}>
                        <SelectTrigger className="bg-white/20 border-white/30 text-white focus:ring-fpl-green focus:border-fpl-green">
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      {registerForm.formState.errors.gender && (
                        <p className="text-red-400 text-sm mt-1">
                          {registerForm.formState.errors.gender.message}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Terms and Conditions Acceptance */}
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Checkbox 
                        id="terms"
                        checked={acceptedTerms}
                        onCheckedChange={setAcceptedTerms}
                        className="border-white/30 data-[state=checked]:bg-fpl-green data-[state=checked]:border-fpl-green mt-1"
                      />
                      <div className="flex-1">
                        <label htmlFor="terms" className="text-white text-sm leading-relaxed cursor-pointer">
                          I agree to the{" "}
                          <PoliciesModal 
                            trigger={
                              <button type="button" className="text-fpl-green hover:text-green-400 underline font-medium">
                                Terms & Conditions and Privacy Policy
                              </button>
                            }
                          />
                        </label>
                      </div>
                    </div>
                    {!acceptedTerms && (
                      <p className="text-yellow-400 text-xs ml-6">
                        You must accept the terms and conditions to create an account
                      </p>
                    )}
                  </div>
                  
                  <Button
                    type="submit"
                    className="w-full bg-fpl-green hover:bg-green-600 text-white"
                    disabled={registerMutation.isPending || !acceptedTerms}
                  >
                    {registerMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Create Account
                  </Button>
                </form>
              )}
  
              <div className="text-center">
                <p className="text-white/70 text-sm">
                  {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                  <Button
                    variant="link"
                    className="text-fpl-green hover:text-green-400 p-0"
                    onClick={() => {
                      setIsLogin(!isLogin);
                      // Reset forms when switching
                      loginForm.reset();
                      registerForm.reset();
                    }}
                  >
                    {isLogin ? "Sign Up" : "Sign In"}
                  </Button>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
  
        {/* Right side - Hero (hidden on mobile/tablet, visible on desktop) */}
        <div className="hidden lg:flex flex-1 items-center justify-center p-8 bg-gradient-to-br from-fpl-purple to-purple-800">
          <div className="text-center max-w-lg">
            <img 
              src="/fantasy_logo.jpg" 
              alt="Fantasy Picks Logo" 
              className="h-32 xl:h-40 w-auto mx-auto mb-6"
            />
            <h1 className="text-3xl xl:text-4xl font-bold text-white mb-4">
              Fantasy Picks
            </h1>
            <h2 className="text-xl xl:text-2xl font-semibold text-fpl-green mb-6">
              Weekly Competition
            </h2>
            <div className="space-y-3 xl:space-y-4 text-white/80">
              <p className="text-base xl:text-lg flex items-center justify-center gap-2">
                <Trophy className="h-4 xl:h-5 w-4 xl:w-5 text-fpl-green" />
                Independent weekly competitions
              </p>
              <p className="text-base xl:text-lg flex items-center justify-center gap-2">
                <DollarSign className="h-4 xl:h-5 w-4 xl:w-5 text-fpl-green" />
                Fresh 100M budget every gameweek
              </p>
              <p className="text-base xl:text-lg flex items-center justify-center gap-2">
                <Target className="h-4 xl:h-5 w-4 xl:w-5 text-fpl-green" />
                Win exciting rewards weekly
              </p>
              <p className="text-base xl:text-lg flex items-center justify-center gap-2">
                <Zap className="h-4 xl:h-5 w-4 xl:w-5 text-fpl-green" />
                Real-time scoring & leaderboards
              </p>
            </div>
            <div className="mt-6 xl:mt-8 p-4 xl:p-6 bg-white/10 rounded-lg border border-white/20 backdrop-blur-sm">
              <p className="text-sm text-white/70 mb-2">Contest Prize</p>
              <p className="text-3xl xl:text-4xl font-bold text-fpl-green">₹10,000</p>
              <p className="text-sm text-white/70">to be won in the contest</p>
            </div>
          </div>
        </div>
  
        {/* Mobile Hero Section - Compact version shown at bottom on mobile */}
        <div className="lg:hidden bg-gradient-to-r from-fpl-purple to-purple-800 px-4 py-6">
          <div className="text-center max-w-sm mx-auto">
            <div className="flex items-center justify-center gap-3 mb-4">
              <img 
                src="/fantasy_logo.jpg" 
                alt="Fantasy Picks Logo" 
                className="h-12 w-auto"
              />
              <div>
                <h2 className="text-lg font-bold text-white">Fantasy Picks</h2>
                <p className="text-sm text-fpl-green font-semibold">Weekly Competition</p>
              </div>
            </div>
            <div className="flex justify-center items-center gap-4 text-xs text-white/80 mb-4">
              <span className="flex items-center gap-1">
                <Trophy className="h-3 w-3 text-fpl-green" />
                Weekly contests
              </span>
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3 text-fpl-green" />
                ₹10,000 prize
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
