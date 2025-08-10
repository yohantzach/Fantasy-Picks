import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, type InsertUser } from "@shared/schema";
import { z } from "zod";
import { Loader2, Volleyball, Trophy, DollarSign, Target, Zap } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

type LoginData = z.infer<typeof loginSchema>;

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [isLogin, setIsLogin] = useState(true);

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
    <div className="min-h-screen bg-gradient-to-br from-fpl-purple via-purple-900 to-fpl-purple flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="w-full max-w-md glass-card border-white/20">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-white">
              {isLogin ? "Welcome Back" : "Join Fantasy Picks"}
            </CardTitle>
            <p className="text-white/70">
              {isLogin ? "Sign in to manage your team" : "Create your account to start playing"}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLogin ? (
              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
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
                <Button
                  type="submit"
                  className="w-full bg-fpl-green hover:bg-green-600 text-white"
                  disabled={registerMutation.isPending}
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

      {/* Right side - Hero */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-fpl-purple to-purple-800">
        <div className="text-center max-w-lg">
          <Volleyball className="h-24 w-24 text-fpl-green mx-auto mb-6" />
          <h1 className="text-4xl font-bold text-white mb-4">
            Fantasy Premier League
          </h1>
          <h2 className="text-2xl font-semibold text-fpl-green mb-6">
            Weekly Competition
          </h2>
          <div className="space-y-4 text-white/80">
            <p className="text-lg flex items-center justify-center gap-2">
              <Trophy className="h-5 w-5 text-fpl-green" />
              Independent weekly competitions
            </p>
            <p className="text-lg flex items-center justify-center gap-2">
              <DollarSign className="h-5 w-5 text-fpl-green" />
              Fresh 100M budget every gameweek
            </p>
            <p className="text-lg flex items-center justify-center gap-2">
              <Target className="h-5 w-5 text-fpl-green" />
              Compete for weekly prizes
            </p>
            <p className="text-lg flex items-center justify-center gap-2">
              <Zap className="h-5 w-5 text-fpl-green" />
              Real-time scoring & leaderboards
            </p>
          </div>
          <div className="mt-8 p-6 bg-white/10 rounded-lg border border-white/20 backdrop-blur-sm">
            <p className="text-sm text-white/70 mb-2">Entry Fee</p>
            <p className="text-4xl font-bold text-fpl-green">₹20</p>
            <p className="text-sm text-white/70">per gameweek</p>
          </div>
        </div>
      </div>
    </div>
  );
}
