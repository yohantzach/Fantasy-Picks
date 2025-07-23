import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, AlertCircle } from "lucide-react";

type DeadlineTimerProps = {
  deadline: string;
  gameweek: number;
  compact?: boolean;
};

export default function DeadlineTimer({ deadline, gameweek, compact = false }: DeadlineTimerProps) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const deadlineTime = new Date(deadline).getTime();
      const now = new Date().getTime();
      const difference = deadlineTime - now;

      if (difference <= 0) {
        setIsExpired(true);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
      setIsExpired(false);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [deadline]);

  const formatTime = (value: number) => value.toString().padStart(2, '0');

  if (compact) {
    return (
      <div className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-white text-sm font-semibold ${
        isExpired 
          ? "bg-red-500" 
          : timeLeft.days === 0 && timeLeft.hours < 2 
            ? "bg-red-500 animate-pulse" 
            : "bg-gradient-to-r from-red-500 to-red-600"
      }`}>
        <Clock className="h-4 w-4" />
        <span>
          {isExpired 
            ? "GW Ended" 
            : `GW${gameweek}: ${timeLeft.days}d ${formatTime(timeLeft.hours)}h ${formatTime(timeLeft.minutes)}m`
          }
        </span>
      </div>
    );
  }

  return (
    <Card className={`glass-card border-white/20 mb-6 ${
      isExpired 
        ? "border-red-500/50" 
        : timeLeft.days === 0 && timeLeft.hours < 2 
          ? "border-red-500/50 animate-pulse" 
          : ""
    }`}>
      <CardContent className="p-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            {isExpired ? (
              <AlertCircle className="h-5 w-5 text-red-500" />
            ) : (
              <Clock className="h-5 w-5 text-fpl-green" />
            )}
            <h3 className="text-white font-semibold">
              Gameweek {gameweek} {isExpired ? "Ended" : "Deadline"}
            </h3>
          </div>
          
          {isExpired ? (
            <div className="text-red-400 font-medium">
              Team selection is now closed
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-4 mb-2">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{formatTime(timeLeft.days)}</div>
                  <div className="text-xs text-white/60">Days</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{formatTime(timeLeft.hours)}</div>
                  <div className="text-xs text-white/60">Hours</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{formatTime(timeLeft.minutes)}</div>
                  <div className="text-xs text-white/60">Minutes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{formatTime(timeLeft.seconds)}</div>
                  <div className="text-xs text-white/60">Seconds</div>
                </div>
              </div>
              <div className="text-sm text-white/70">
                {timeLeft.days === 0 && timeLeft.hours < 2 && (
                  <span className="text-red-400 font-medium">Deadline approaching!</span>
                )}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
