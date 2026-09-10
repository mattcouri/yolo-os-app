import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function CalendarPage() {
  const today = new Date();
  const monthName = today.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendário</h1>
          <p className="text-muted-foreground">
            Eventos, entregas e agenda operacional
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo evento
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="capitalize">{monthName}</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm">
                Hoje
              </Button>
              <Button variant="outline" size="icon">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <CardDescription>
            Visualização mensal de eventos e entregas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-sm">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
              <div key={day} className="p-2 font-medium text-muted-foreground">
                {day}
              </div>
            ))}
            {Array.from({ length: 35 }, (_, i) => {
              const dayNum = i - today.getDay() + 1;
              const isToday = dayNum === today.getDate();
              const isCurrentMonth = dayNum > 0 && dayNum <= 30;
              return (
                <div
                  key={i}
                  className={`aspect-square p-2 rounded-lg ${
                    isToday
                      ? "bg-primary text-primary-foreground"
                      : isCurrentMonth
                      ? "hover:bg-muted cursor-pointer"
                      : "text-muted-foreground/30"
                  }`}
                >
                  {isCurrentMonth ? dayNum : ""}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Próximos eventos</CardTitle>
          <CardDescription>
            Entregas e eventos agendados para os próximos dias
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nenhum evento agendado. Adicione eventos pelo botão acima.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
