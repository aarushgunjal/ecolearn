import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle, 
  Lock, 
  Zap, 
  TreePine, 
  Droplets, 
  Car,
  Award,
  Star
} from "lucide-react";

export default function SkillTree() {
  const skills = [
    {
      id: 1,
      name: "Energy Basics",
      icon: Zap,
      level: 3,
      maxLevel: 5,
      unlocked: true,
      completed: true,
      xp: 150,
      color: "from-yellow-400 to-orange-500",
      description: "Master the fundamentals of energy conservation"
    },
    {
      id: 2,
      name: "Smart Home",
      icon: Zap,
      level: 2,
      maxLevel: 4,
      unlocked: true,
      completed: false,
      xp: 80,
      color: "from-yellow-400 to-orange-500",
      description: "Advanced home automation for efficiency"
    },
    {
      id: 3,
      name: "Recycling Pro",
      icon: TreePine,
      level: 2,
      maxLevel: 5,
      unlocked: true,
      completed: false,
      xp: 90,
      color: "from-green-400 to-emerald-600",
      description: "Advanced waste sorting and recycling"
    },
    {
      id: 4,
      name: "Zero Waste",
      icon: TreePine,
      level: 0,
      maxLevel: 3,
      unlocked: false,
      completed: false,
      xp: 0,
      color: "from-green-400 to-emerald-600",
      description: "Achieve a zero-waste lifestyle"
    },
    {
      id: 5,
      name: "Sustainable Diet",
      icon: Droplets,
      level: 1,
      maxLevel: 4,
      unlocked: true,
      completed: false,
      xp: 45,
      color: "from-blue-400 to-cyan-500",
      description: "Plant-based and local food choices"
    },
    {
      id: 6,
      name: "Green Transport",
      icon: Car,
      level: 0,
      maxLevel: 3,
      unlocked: false,
      completed: false,
      xp: 0,
      color: "from-purple-400 to-indigo-500",
      description: "Eco-friendly transportation methods"
    }
  ];

  const totalXP = skills.reduce((sum, skill) => sum + skill.xp, 0);
  const completedSkills = skills.filter(skill => skill.completed).length;

  return (
    <div className="min-h-screen bg-background pb-20 p-4 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Eco Skill Tree</h1>
        <p className="text-muted-foreground">Level up your environmental impact</p>
      </div>

      {/* Stats */}
      <div className="bg-gradient-to-r from-eco-primary to-eco-secondary rounded-2xl p-6 text-white">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">{totalXP}</div>
            <div className="text-sm text-white/80">Total XP</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{completedSkills}</div>
            <div className="text-sm text-white/80">Skills Mastered</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{skills.length}</div>
            <div className="text-sm text-white/80">Skills Available</div>
          </div>
        </div>
      </div>

      {/* Skill Tree */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Star className="w-5 h-5 text-primary" />
          Your Skills
        </h2>
        
        <div className="grid gap-4">
          {skills.map((skill, index) => (
            <Card 
              key={skill.id}
              className={`overflow-hidden transition-all duration-300 ${
                skill.unlocked 
                  ? 'hover:shadow-eco hover:scale-[1.02] cursor-pointer' 
                  : 'opacity-75'
              } ${skill.completed ? 'ring-2 ring-success/50' : ''}`}
            >
              <div className={`h-2 bg-gradient-to-r ${skill.color}`} />
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`relative p-3 rounded-full bg-gradient-to-r ${skill.color}`}>
                      <skill.icon className="w-6 h-6 text-white" />
                      {skill.completed && (
                        <CheckCircle className="absolute -top-1 -right-1 w-5 h-5 text-success bg-white rounded-full" />
                      )}
                      {!skill.unlocked && (
                        <Lock className="absolute -top-1 -right-1 w-5 h-5 text-muted-foreground bg-white rounded-full p-0.5" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{skill.name}</h3>
                      <p className="text-sm text-muted-foreground">{skill.description}</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <Badge 
                      variant={skill.completed ? "default" : "secondary"}
                      className={skill.completed ? "bg-success hover:bg-success" : ""}
                    >
                      Level {skill.level}/{skill.maxLevel}
                    </Badge>
                    <div className="text-sm text-muted-foreground mt-1">
                      {skill.xp} XP
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {/* Level Progress */}
                  <div className="flex gap-1">
                    {Array.from({ length: skill.maxLevel }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-2 flex-1 rounded-full ${
                          i < skill.level 
                            ? `bg-gradient-to-r ${skill.color}` 
                            : 'bg-muted'
                        }`}
                      />
                    ))}
                  </div>
                  
                  {skill.unlocked ? (
                    <Button 
                      className={`w-full ${
                        skill.completed
                          ? 'bg-success hover:bg-success text-white'
                          : 'bg-gradient-to-r from-eco-primary to-eco-secondary text-white'
                      }`}
                    >
                      {skill.completed ? (
                        <>
                          <Award className="w-4 h-4 mr-2" />
                          Mastered!
                        </>
                      ) : (
                        <>
                          <Star className="w-4 h-4 mr-2" />
                          Continue Learning
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      className="w-full border-muted text-muted-foreground cursor-not-allowed"
                      disabled
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      Unlock with 100 XP
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}