import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Zap, Trash2, Leaf, Car, CheckCircle, BookOpen, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProgress } from "@/hooks/useProgress";
import { useAchievements } from "@/hooks/useAchievements";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

const categoryIcons: Record<string, LucideIcon> = {
  "Energy Saving": Zap,
  "Waste Reduction": Trash2,
  "Sustainable Food": Leaf,
  "Eco Travel": Car,
};

const difficultyColors: Record<string, string> = {
  beginner: "bg-success/10 text-success border-success/20",
  intermediate: "bg-primary/10 text-primary border-primary/20",
  advanced: "bg-destructive/10 text-destructive border-destructive/20",
};

// Built-in lessons with educational content
const defaultLessons = [
  {
    id: "lesson-1",
    title: "Understanding Recycling Basics",
    category: "Waste Reduction",
    difficulty: "beginner",
    description:
      "Learn the fundamentals of recycling and what materials can be recycled.",
    xp_reward: 50,
    order_index: 1,
    content: `
# Understanding Recycling Basics

## What is Recycling?
Recycling is the process of converting waste materials into new materials and objects. It's an alternative to conventional waste disposal that can save material and help lower greenhouse gas emissions.

## Why Recycle?
- **Conserves Natural Resources**: Recycling reduces the need to grow, harvest, or extract new raw materials from the Earth
- **Saves Energy**: Making products from recycled materials requires less energy than making products from virgin materials
- **Reduces Pollution**: Recycling reduces the amount of waste sent to landfills and incinerators
- **Protects Ecosystems**: By reducing the need for extracting raw materials, we preserve rainforests, wetlands, and other natural habitats

## Common Recyclable Materials
1. **Paper & Cardboard**: Newspapers, magazines, cardboard boxes
2. **Plastic**: Bottles, containers (check the recycling number)
3. **Glass**: Bottles and jars
4. **Metal**: Aluminum cans, tin cans, steel food containers

## The Three R's
- **Reduce**: Use less to begin with
- **Reuse**: Find ways to use items multiple times
- **Recycle**: Process materials to make new products

## Quick Tips
- Rinse containers before recycling
- Remove caps and lids (they may be different materials)
- Don't bag recyclables - they should be loose in the bin
- When in doubt, check your local recycling guidelines
    `,
  },
  {
    id: "lesson-2",
    title: "Composting 101",
    category: "Waste Reduction",
    difficulty: "beginner",
    description: "Discover how to turn food scraps into nutrient-rich soil.",
    xp_reward: 50,
    order_index: 2,
    content: `
# Composting 101

## What is Composting?
Composting is nature's process of recycling decomposed organic materials into a rich soil known as compost. It's one of the best ways to reduce waste while creating something beneficial for your garden.

## Benefits of Composting
- **Reduces Waste**: Diverts 30% of household waste from landfills
- **Enriches Soil**: Creates nutrient-rich humus for gardens
- **Reduces Methane**: Prevents organic waste from producing methane in landfills
- **Saves Money**: Free fertilizer for your plants!

## What Can You Compost?

### Greens (Nitrogen-Rich)
- Fruit and vegetable scraps
- Coffee grounds and filters
- Tea bags
- Fresh grass clippings
- Plant trimmings

### Browns (Carbon-Rich)
- Dry leaves
- Shredded newspaper
- Cardboard (torn into small pieces)
- Wood chips
- Straw or hay

## What NOT to Compost
❌ Meat or fish
❌ Dairy products
❌ Oils and fats
❌ Pet waste
❌ Diseased plants

## Basic Composting Steps
1. **Choose a Location**: Pick a dry, shady spot
2. **Layer Materials**: Alternate greens and browns
3. **Add Water**: Keep it moist like a wrung-out sponge
4. **Turn Regularly**: Mix every 1-2 weeks for faster decomposition
5. **Harvest**: In 2-3 months, you'll have usable compost!

## Quick Tips
- Chop or shred larger items for faster decomposition
- Maintain a balance of greens (wet) to browns (dry) - aim for 1:2 ratio
- If it smells bad, add more browns
- If it's not breaking down, add more greens and water
    `,
  },
  {
    id: "lesson-3",
    title: "Energy Conservation at Home",
    category: "Energy Saving",
    difficulty: "beginner",
    description: "Learn simple ways to reduce your home's energy consumption.",
    xp_reward: 60,
    order_index: 3,
    content: `
# Energy Conservation at Home

## Why Conserve Energy?
- **Lower Bills**: Save money on electricity and gas
- **Reduce Carbon Footprint**: Less energy use means fewer greenhouse gas emissions
- **Preserve Resources**: Fossil fuels are finite
- **Protect the Environment**: Reduce pollution and climate change impact

## Easy Ways to Save Energy

### Lighting
- **Switch to LEDs**: Use 75% less energy than incandescent bulbs
- **Turn Off Lights**: When leaving a room
- **Use Natural Light**: Open curtains during the day
- **Install Dimmers**: Adjust brightness as needed

### Heating & Cooling
- **Adjust Thermostat**: Lower by 2°F in winter, raise by 2°F in summer
- **Seal Air Leaks**: Check windows, doors, and ducts
- **Use Programmable Thermostats**: Automatically adjust when you're away
- **Maintain HVAC**: Regular filter changes improve efficiency

### Appliances
- **Unplug Devices**: Eliminate phantom energy drain
- **Use Energy Star**: Choose efficient appliances
- **Full Loads Only**: Run dishwashers and washing machines when full
- **Air Dry**: Skip the dryer when possible

### Water Heating
- **Lower Temperature**: Set to 120°F (49°C)
- **Insulate Tank**: Keep heat from escaping
- **Fix Leaks**: A dripping faucet wastes both water and energy
- **Take Shorter Showers**: Each minute saves gallons of hot water

## Seasonal Tips

### Summer
- Use ceiling fans (they use less energy than AC)
- Close blinds during peak sun hours
- Grill outside instead of using the oven

### Winter
- Open curtains on sunny days
- Use a humidifier (moist air feels warmer)
- Reverse ceiling fan direction

## Energy Vampire Appliances
These devices draw power even when "off":
- Chargers (phone, laptop)
- TVs and cable boxes
- Gaming consoles
- Coffee makers
- Microwaves

**Solution**: Use power strips and turn them off when not in use!
    `,
  },
  {
    id: "lesson-4",
    title: "Sustainable Food Choices",
    category: "Sustainable Food",
    difficulty: "intermediate",
    description: "Explore how your food choices impact the environment.",
    xp_reward: 75,
    order_index: 4,
    content: `
# Sustainable Food Choices

## The Environmental Impact of Food

Our food system accounts for about 25% of global greenhouse gas emissions. The good news? Every meal is an opportunity to make a positive impact!

## Key Principles of Sustainable Eating

### 1. Eat More Plants
- **Reduce Meat Consumption**: Livestock production generates 14.5% of global greenhouse gases
- **Try Meatless Mondays**: Even one day a week makes a difference
- **Explore Plant Proteins**: Beans, lentils, tofu, tempeh, nuts

### 2. Buy Local and Seasonal
- **Reduces Transportation**: Less fuel = lower carbon footprint
- **Supports Local Farmers**: Strengthens community economy
- **Fresher Food**: Better taste and nutrition
- **Seasonal Eating**: Foods grown in-season require less energy

### 3. Reduce Food Waste
- **Plan Meals**: Shop with a list
- **Proper Storage**: Keep produce fresh longer
- **Use Leftovers**: Get creative with meal planning
- **Compost**: Give scraps a second life

### 4. Choose Sustainable Seafood
- **Check Sustainability**: Use guides like Seafood Watch
- **Avoid Overfished Species**: Protect ocean ecosystems
- **Consider Farmed Fish**: But check farming practices

### 5. Minimize Packaging
- **Bring Reusable Bags**: For produce and groceries
- **Buy in Bulk**: Reduces package waste
- **Choose Glass or Paper**: Over plastic when possible
- **Skip Single-Serve**: Buy larger portions

## Understanding Labels

### Organic
- No synthetic pesticides or fertilizers
- Better for soil health
- Often more expensive but worth it for certain items (the "Dirty Dozen")

### Fair Trade
- Ensures fair wages for farmers
- Promotes sustainable practices
- Common for coffee, chocolate, tea

### Grass-Fed/Pastured
- Animals raised on pasture
- Better for animal welfare
- Can have lower environmental impact

## The Dirty Dozen (Buy These Organic)
1. Strawberries
2. Spinach
3. Kale
4. Apples
5. Grapes
6. Peaches
7. Cherries
8. Pears
9. Tomatoes
10. Celery
11. Potatoes
12. Bell Peppers

## The Clean Fifteen (Okay to Buy Conventional)
1. Avocados
2. Sweet Corn
3. Pineapple
4. Onions
5. Papaya
6. Sweet Peas
7. Eggplant
8. Asparagus
9. Broccoli
10. Cabbage
11. Kiwi
12. Cauliflower
13. Mushrooms
14. Honeydew
15. Cantaloupe

## Easy Swaps
- ❌ Beef → ✅ Chicken or fish (or beans!)
- ❌ Bottled water → ✅ Filtered tap water
- ❌ Imported produce → ✅ Local farmers market
- ❌ Packaged snacks → ✅ Whole fruits and nuts
- ❌ Food delivery → ✅ Home cooking

## Remember
Perfect is the enemy of good! Every sustainable choice, no matter how small, adds up to make a real difference.
    `,
  },
  {
    id: "lesson-5",
    title: "Reducing Plastic Use",
    category: "Waste Reduction",
    difficulty: "intermediate",
    description:
      "Practical strategies to minimize single-use plastics in daily life.",
    xp_reward: 75,
    order_index: 5,
    content: `
# Reducing Plastic Use

## The Plastic Problem

- **500 billion** plastic bags are used worldwide every year
- **8 million** metric tons of plastic enter oceans annually
- Plastic takes **400-1,000 years** to decompose
- Only **9%** of all plastic ever made has been recycled

## Why Reduce Plastic?

### Environmental Impact
- **Ocean Pollution**: Harms marine life (1 million+ seabirds and 100,000+ marine mammals die annually)
- **Microplastics**: Enter food chain and drinking water
- **Greenhouse Gases**: Plastic production releases CO₂
- **Landfill Waste**: Takes up valuable space

### Health Concerns
- BPA and phthalates can leach into food
- Microplastics found in human blood and organs
- Unknown long-term health effects

## Easy Swaps to Make Today

### In the Kitchen
- ❌ Plastic bags → ✅ Reusable produce bags
- ❌ Plastic wrap → ✅ Beeswax wraps or glass containers
- ❌ Plastic bottles → ✅ Reusable water bottles
- ❌ Plastic straws → ✅ Metal, bamboo, or glass straws
- ❌ Plastic utensils → ✅ Reusable cutlery

### Shopping
- ❌ Single-use bags → ✅ Reusable shopping bags
- ❌ Packaged produce → ✅ Loose produce
- ❌ Plastic containers → ✅ Glass jars for bulk items
- ❌ Bottled drinks → ✅ Canned or glass bottles

### Bathroom
- ❌ Plastic toothbrush → ✅ Bamboo toothbrush
- ❌ Bottled soap → ✅ Bar soap
- ❌ Disposable razors → ✅ Safety razor
- ❌ Plastic cotton swabs → ✅ Paper or reusable swabs
- ❌ Plastic bottles → ✅ Refillable containers

### On the Go
- ❌ Plastic cutlery → ✅ Travel utensil kit
- ❌ Disposable cups → ✅ Reusable coffee cup
- ❌ Plastic bags → ✅ Foldable shopping bag
- ❌ Bottled water → ✅ Refillable bottle

## The 5 R's of Plastic Reduction

1. **Refuse**: Say no to single-use plastics
2. **Reduce**: Buy less plastic overall
3. **Reuse**: Choose reusable alternatives
4. **Recycle**: Properly recycle what you can't avoid
5. **Rot**: Compost instead of throwing away

## Tips for Success

### Start Small
- Don't try to eliminate all plastic at once
- Pick one or two swaps to start with
- Build habits gradually

### Plan Ahead
- Keep reusables in your car or bag
- Bring containers when eating out
- Pack snacks in reusable containers

### Make It Convenient
- Keep reusable bags at your door
- Store produce bags with grocery bags
- Keep a reusable water bottle with you

### Support the Right Companies
- Buy from companies using sustainable packaging
- Support plastic-free stores
- Vote with your dollar

## Plastic Numbers Guide

Not all plastics are created equal. Here's what those numbers mean:

1. **#1 PET**: Water bottles - Recyclable
2. **#2 HDPE**: Milk jugs - Recyclable
3. **#3 PVC**: Pipes - Avoid (contains toxins)
4. **#4 LDPE**: Grocery bags - Sometimes recyclable
5. **#5 PP**: Yogurt containers - Recyclable
6. **#6 PS**: Styrofoam - Not recyclable (avoid!)
7. **#7 Other**: Mixed - Usually not recyclable

## Challenge Yourself

### Week 1: Awareness
Track every plastic item you use

### Week 2: Bring Your Own
Bags, bottles, utensils

### Week 3: Refuse Single-Use
Say no to straws, bags, etc.

### Week 4: Find Alternatives
Research swaps for items you use most

## Remember
Every piece of plastic you refuse makes a difference. Your choices matter!
    `,
  },
  {
    id: "lesson-6",
    title: "Eco-Friendly Transportation",
    category: "Eco Travel",
    difficulty: "intermediate",
    description: "Learn about sustainable transportation options.",
    xp_reward: 70,
    order_index: 6,
    content: `
# Eco-Friendly Transportation

## Transportation's Environmental Impact

Transportation accounts for about **29%** of greenhouse gas emissions in the United States, making it the largest contributor to climate change.

## Sustainable Transportation Options

### 1. Walking & Biking
**Benefits:**
- Zero emissions
- Free!
- Health benefits
- No parking hassles

**Tips:**
- Use for trips under 2 miles
- Invest in a good bike and safety gear
- Check local bike paths and trails
- Consider e-bikes for longer distances

### 2. Public Transportation
**Benefits:**
- **60-70%** less CO₂ than driving
- Reduces traffic congestion
- Often cheaper than car ownership
- Productive time (read, work, relax)

**Tips:**
- Download transit apps
- Get a monthly pass for savings
- Combine with walking or biking

### 3. Carpooling & Ridesharing
**Benefits:**
- Reduces traffic and emissions
- Splits costs
- HOV lane access
- Social connection

**Options:**
- **Carpool**: Regular route with coworkers or neighbors
- **Vanpool**: Group commute in shared van
- **Rideshare Apps**: Share rides for specific trips

### 4. Electric & Hybrid Vehicles
**Benefits:**
- Zero tailpipe emissions (electric)
- Lower operating costs
- Reduced air pollution
- Quiet operation

**Considerations:**
- Higher upfront cost (offset by fuel savings)
- Charging infrastructure needs
- Battery recycling programs
- Check for tax incentives

### 5. Efficient Driving Habits
**If you must drive:**
- Maintain steady speed
- Avoid rapid acceleration
- Keep tires properly inflated
- Remove unnecessary weight
- Use cruise control on highways
- Turn off engine if idle > 30 seconds

## Transportation Emissions Comparison

**Per Passenger Mile:**
- Walking/Biking: 0g CO₂
- Bus: 89g CO₂
- Train: 41g CO₂
- Carpool (4 people): 55g CO₂
- Hybrid car: 120g CO₂
- Average car: 190g CO₂
- SUV: 280g CO₂

## Making the Switch

### Assess Your Needs
- How far do you travel daily?
- Is public transit available?
- Can you combine errands?
- Do you really need a car?

### Start Small
1. **Week 1**: Walk/bike for one errand
2. **Week 2**: Try public transit once
3. **Week 3**: Organize a carpool
4. **Week 4**: Track your carbon savings

### Reduce Car Dependency
- Live closer to work
- Choose walkable neighborhoods
- Support local businesses
- Work from home when possible

## Air Travel

Flying has a significant carbon footprint. When you fly:

### Reduce Impact
- Choose direct flights (takeoff/landing use most fuel)
- Pack light
- Fly economy (more passengers per flight)
- Purchase carbon offsets
- Fly less, stay longer

### Alternatives
- Train for medium distances
- Video conferencing for meetings
- Staycations and local tourism

## The Future of Transportation

### Emerging Technologies
- **Electric Vehicles**: Improving range and affordability
- **Autonomous Vehicles**: Could reduce emissions through efficiency
- **Hyperloop**: High-speed, low-emission long-distance travel
- **Electric Scooters/Bikes**: First/last mile solutions

### Infrastructure Changes
- More bike lanes
- Expanded public transit
- EV charging stations
- Pedestrian-friendly cities

## Calculate Your Impact

**Example Commute (10 miles each way):**
- Driving alone: **5,200 lbs CO₂/year**
- Carpooling: **1,300 lbs CO₂/year**
- Public transit: **1,000 lbs CO₂/year**
- Biking: **0 lbs CO₂/year**

**Cost Savings (Annual):**
- Gas: $1,500-2,000
- Maintenance: $1,200
- Insurance: $1,200
- Parking: $1,000-3,000
**Total**: $4,900-7,200/year

## Action Steps

1. **Track** your current transportation
2. **Identify** opportunities for change
3. **Try** alternatives one at a time
4. **Calculate** your savings and impact
5. **Share** your success to inspire others

## Remember
Even small changes add up! Every trip you don't drive alone is a win for the planet.
    `,
  },
  {
    id: "lesson-7",
    title: "Water Conservation",
    category: "Energy Saving",
    difficulty: "beginner",
    description: "Simple techniques to reduce water waste at home.",
    xp_reward: 55,
    order_index: 7,
    content: `
# Water Conservation

## Why Conserve Water?

While Earth is called the "blue planet," only **3%** of water is freshwater, and only **1%** is accessible for human use.

### The Impact
- **Climate Change**: Affects water availability
- **Growing Population**: Increased demand
- **Energy Intensive**: Water treatment requires energy
- **Save Money**: Lower utility bills

## Water Usage Facts

**Average American uses:**
- **80-100 gallons** of water per day
- **70%** is used indoors
- **30%** is used outdoors

**Breakdown:**
- Toilets: 27%
- Washing machines: 22%
- Showers: 17%
- Faucets: 16%
- Leaks: 13%
- Other: 5%

## Indoor Water Saving Tips

### Bathroom (50% of indoor water use)

**Toilet:**
- Install low-flow (1.28 gallons) vs old (3.5 gallons)
- Don't use as trash (each flush wastes gallons)
- Fix leaks immediately
- Consider dual-flush toilets

**Shower:**
- Install low-flow showerhead (2.5 gpm vs 5 gpm)
- Take 5-minute showers
- Turn off while soaping
- Save **2.5 gallons per minute**!

**Sink:**
- Turn off while brushing teeth
- Install aerators
- Fix dripping faucets (save 3,000 gallons/year)
- Use a cup for rinsing

### Kitchen

**Dishwashing:**
- Run only full loads
- Use dishwasher (more efficient than hand washing)
- Scrape, don't rinse plates
- Energy Star dishwashers use 4 gallons vs 27 hand washing

**Cooking:**
- Steam vegetables (uses less water)
- Reuse pasta water for plants
- Keep drinking water in fridge (no running for cold water)
- Defrost in fridge, not under running water

### Laundry

- Wash only full loads
- Use cold water (saves energy too!)
- High-efficiency washers use 20-25 gallons vs 40
- Consider a front-loader (uses less water)

## Outdoor Water Saving

### Lawn & Garden (30% of household water use)

**Watering Wisdom:**
- Water early morning or evening (less evaporation)
- Water deeply but less frequently
- Use drip irrigation or soaker hoses
- Collect rainwater in barrels
- Choose native, drought-resistant plants

**Lawn Care:**
- Raise mower blade (longer grass needs less water)
- Leave clippings (natural mulch retains moisture)
- Aerate lawn
- Consider reducing lawn size

### Swimming Pools
- Use a cover (prevents evaporation)
- Fix leaks
- Lower water level
- Consider saltwater system

## Leak Detection

**Check for leaks:**
1. Read water meter
2. Don't use water for 2 hours
3. Read meter again
4. If it changed, you have a leak!

**Common leak sources:**
- Toilets (add food coloring to tank, if color appears in bowl, you have a leak)
- Faucets
- Showerheads
- Outdoor hoses
- Underground pipes

**One drop per second = 3,000 gallons/year!**

## Water-Saving Devices

### Low-Cost Options
- Faucet aerators: $5-10
- Low-flow showerheads: $15-50
- Toilet tank banks: $5-15
- Shower timers: $5-10

### Bigger Investments
- Low-flow toilets: $100-300
- High-efficiency washing machines: $600-1,200
- Tankless water heaters: $1,000-3,000
- Drip irrigation: $100-500

**ROI:** Most pay for themselves in water savings!

## Gray Water Reuse

Gray water = lightly used water from:
- Bathroom sinks
- Showers
- Washing machines

**Can be reused for:**
- Watering plants
- Flushing toilets
- Outdoor cleaning

**Note:** Check local regulations before implementing

## Challenge: 30-Day Water Diet

### Week 1: Track
- Monitor water usage
- Identify waste

### Week 2: Fix
- Repair leaks
- Install aerators

### Week 3: Change Habits
- Shorter showers
- Full loads only
- Turn off taps

### Week 4: Upgrade
- Low-flow devices
- Efficient appliances

## Potential Savings

**Average family can save:**
- **30,000 gallons/year** with efficient fixtures
- **$380/year** on water and energy bills
- **$1,000+/year** with all improvements

## Remember

Every drop counts! Small changes in daily habits can lead to significant water savings and a healthier planet.
    `,
  },
  {
    id: "lesson-8",
    title: "Green Cleaning",
    category: "Waste Reduction",
    difficulty: "beginner",
    description: "Make your own eco-friendly cleaning products.",
    xp_reward: 60,
    order_index: 8,
    content: `
# Green Cleaning

## Why Go Green with Cleaning?

Traditional cleaning products contain harsh chemicals that:
- Pollute indoor air quality
- Harm aquatic ecosystems
- Contribute to plastic waste
- Can cause health issues
- Are expensive

**Good News:** Natural alternatives work just as well!

## Essential Green Cleaning Ingredients

### The Fab Five
1. **White Vinegar** - Disinfects, removes odors, cuts grease
2. **Baking Soda** - Abrasive cleaner, deodorizer
3. **Castile Soap** - Plant-based, versatile cleaner
4. **Lemon** - Natural bleach, fresh scent, antibacterial
5. **Essential Oils** - Add scent and boost cleaning power

### Other Useful Items
- Olive oil (furniture polish)
- Hydrogen peroxide (disinfectant)
- Cornstarch (windows, carpet)
- Salt (abrasive scrubber)

## DIY Cleaning Recipes

### All-Purpose Cleaner
**Ingredients:**
- 2 cups water
- 2 tablespoons white vinegar
- 20 drops essential oil (tea tree, lavender, or lemon)

**Instructions:**
1. Mix in spray bottle
2. Shake before use
3. Use on counters, sinks, most surfaces

**Cost:** $0.50 vs $4 store-bought

### Glass & Window Cleaner
**Ingredients:**
- 2 cups water
- 1/4 cup white vinegar
- 1/2 teaspoon liquid castile soap

**Instructions:**
1. Mix in spray bottle
2. Spray on glass
3. Wipe with newspaper or microfiber cloth

**Streak-free shine!**

### Scrubbing Powder
**Ingredients:**
- 1 cup baking soda
- 1/4 cup salt
- 20 drops essential oil

**Instructions:**
1. Mix in jar
2. Sprinkle on surface
3. Scrub with damp cloth

**Great for:** Sinks, tubs, tile

### Toilet Bowl Cleaner
**Ingredients:**
- 1/2 cup baking soda
- 10 drops tea tree essential oil

**Instructions:**
1. Sprinkle mixture in bowl
2. Let sit 15 minutes
3. Scrub with brush
4. Flush

**Disinfects and deodorizes!**

### Floor Cleaner
**Ingredients:**
- 1 gallon warm water
- 1/4 cup white vinegar
- 1/4 cup liquid castile soap

**Instructions:**
1. Mix in bucket
2. Mop as usual
3. No rinse needed

**Safe for most floor types!**

### Furniture Polish
**Ingredients:**
- 1/4 cup olive oil
- 2 tablespoons lemon juice

**Instructions:**
1. Mix in small bowl
2. Apply with soft cloth
3. Buff to shine

**Natural wood conditioner!**

### Drain Cleaner
**Ingredients:**
- 1/2 cup baking soda
- 1 cup white vinegar
- Boiling water

**Instructions:**
1. Pour baking soda down drain
2. Add vinegar
3. Let fizz 15 minutes
4. Flush with boiling water

**Prevents clogs naturally!**

## Room-by-Room Guide

### Kitchen
- ✅ All-purpose spray
- ✅ Baking soda scrub
- ✅ Vinegar disinfectant
- ✅ Lemon for cutting boards

### Bathroom
- ✅ Toilet cleaner
- ✅ Scrubbing powder
- ✅ Vinegar for mirrors
- ✅ Essential oils for freshness

### Living Areas
- ✅ Furniture polish
- ✅ Floor cleaner
- ✅ Window cleaner
- ✅ Dusting spray

### Laundry
- ✅ Vinegar (fabric softener)
- ✅ Baking soda (boost detergent)
- ✅ Lemon (whitener)

## Green Cleaning Tools

### Reusable Options
- Microfiber cloths (trap dirt without chemicals)
- Old t-shirts/towels (cut into rags)
- Natural sponges
- Wooden scrub brushes
- Glass spray bottles

### Avoid
- ❌ Paper towels
- ❌ Disposable wipes
- ❌ Plastic sponges
- ❌ Single-use products

## Essential Oils Guide

### Best for Cleaning
- **Tea Tree**: Antibacterial, antifungal
- **Lemon**: Grease-cutting, fresh scent
- **Lavender**: Antibacterial, calming
- **Eucalyptus**: Disinfectant, deodorizer
- **Peppermint**: Pest deterrent, energizing

### How to Use
- 10-20 drops per recipe
- Combine for custom scents
- Add to baking soda for air freshener
- Mix with water for room spray

## Safety Tips

### Do's
- ✅ Test on small area first
- ✅ Label all bottles
- ✅ Store safely away from children
- ✅ Use glass containers when possible

### Don'ts
- ❌ Mix vinegar and hydrogen peroxide
- ❌ Use vinegar on granite/marble
- ❌ Store in direct sunlight
- ❌ Use on waxed furniture (removes wax)

## Cost Comparison

**DIY All-Purpose Cleaner:**
- Cost: $0.50/bottle
- Uses: Unlimited applications

**Store-Bought:**
- Cost: $4-6/bottle
- Contains: 20+ chemicals

**Annual Savings: $50-100**

## Environmental Impact

### What You'll Reduce
- Plastic bottles
- Chemical runoff
- Air pollution
- Water contamination
- Packaging waste

### What You'll Gain
- Healthier home
- Cleaner water
- Cost savings
- Peace of mind

## Getting Started

### Week 1: Start Simple
- Make all-purpose cleaner
- Use vinegar for windows
- Try baking soda for scrubbing

### Week 2: Expand
- Create floor cleaner
- Make toilet bowl cleaner
- Mix furniture polish

### Week 3: Replace
- Use up commercial cleaners
- Don't throw away (hazardous waste)
- Reuse spray bottles

### Week 4: Perfect Your System
- Find favorite scents
- Organize supplies
- Share recipes with friends

## Bonus: Air Fresheners

### Natural Options
- Open windows!
- Simmer cinnamon and cloves
- Place bowls of baking soda
- Use essential oil diffuser
- Fresh flowers or plants

### Avoid
- ❌ Aerosol sprays
- ❌ Plug-in air fresheners
- ❌ Scented candles (paraffin)

## Remember

Clean doesn't have a smell! If your home smells like chemicals, it's not actually clean - it's just covered in artificial fragrance.

**Natural cleaning is:**
- Safer for your family
- Better for the environment
- Cheaper
- Just as effective!

Start small, build your collection, and enjoy a healthier home!
    `,
  },
];

type Lesson = (typeof defaultLessons)[number];
type LessonProgress = Database["public"]["Tables"]["user_lesson_progress"]["Row"];

export default function Lessons() {
  const { user } = useAuth();
  const { addXP, incrementLessons, updateStreak, progress } = useProgress();
  const { checkAndAwardAchievements } = useAchievements();
  const { toast } = useToast();
  const [userProgress, setUserProgress] = useState<LessonProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const categories = [
    "All",
    "Energy Saving",
    "Waste Reduction",
    "Sustainable Food",
    "Eco Travel",
  ];

  const fetchProgress = useCallback(async () => {
    if (!user) return;

    const { data: progressData } = await supabase
      .from("user_lesson_progress")
      .select("*")
      .eq("user_id", user.id);

    setUserProgress(progressData || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) {
      void fetchProgress();
    } else {
      setLoading(false);
    }
  }, [fetchProgress, user]);

  const openLesson = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setIsDialogOpen(true);
  };

  const completeLesson = async () => {
    if (!selectedLesson) return;

    const existingProgress = userProgress.find(
      (p) => p.lesson_id === selectedLesson.id
    );

    if (existingProgress?.completed) {
      toast({
        title: "Already completed",
        description: "You've already completed this lesson!",
      });
      return;
    }

    // Save to database if user is logged in
    if (user) {
      const { error } = await supabase.from("user_lesson_progress").upsert({
        user_id: user.id,
        lesson_id: selectedLesson.id,
        completed: true,
        completed_at: new Date().toISOString(),
        score: 100,
      });

      if (error) {
        console.error("Error saving progress:", error);
      }

      await addXP(selectedLesson.xp_reward);
      await incrementLessons();
      await updateStreak();
      await fetchProgress();

      if (progress) {
        await checkAndAwardAchievements(progress);
      }
    } else {
      // For non-logged in users, just update local state
      setUserProgress((prev) => [
        ...prev,
        {
          lesson_id: selectedLesson.id,
          completed: true,
          completed_at: new Date().toISOString(),
        },
      ]);
    }

    toast({
      title: "Lesson Complete! 🎉",
      description: user
        ? `You earned ${selectedLesson.xp_reward} XP!`
        : "Great job learning!",
    });

    setIsDialogOpen(false);
  };

  const isLessonCompleted = (lessonId: string) => {
    return userProgress.some((p) => p.lesson_id === lessonId && p.completed);
  };

  const filteredLessons =
    selectedCategory === "All"
      ? defaultLessons
      : defaultLessons.filter((l) => l.category === selectedCategory);

  const completedCount = userProgress.filter((p) => p.completed).length;
  const totalCount = defaultLessons.length;
  const completionPercentage =
    totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 p-4 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Eco Lessons</h1>
        <p className="text-muted-foreground">Learn sustainable practices</p>
      </div>

      {/* Progress Overview */}
      <Card className="bg-gradient-to-r from-eco-primary/10 to-eco-secondary/10">
        <CardHeader>
          <CardTitle>Your Progress</CardTitle>
          <CardDescription>
            {completedCount} of {totalCount} lessons completed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={completionPercentage} className="h-3" />
        </CardContent>
      </Card>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map((category) => (
          <Button
            key={category}
            variant={selectedCategory === category ? "default" : "outline"}
            onClick={() => setSelectedCategory(category)}
            className="whitespace-nowrap"
          >
            {category}
          </Button>
        ))}
      </div>

      {/* Lessons List */}
      <div className="space-y-4">
        {filteredLessons.map((lesson) => {
          const Icon = categoryIcons[lesson.category] || Leaf;
          const completed = isLessonCompleted(lesson.id);

          return (
            <Card key={lesson.id} className={completed ? "bg-success/5" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      completed
                        ? "bg-success/20"
                        : "bg-gradient-to-r from-eco-primary to-eco-secondary"
                    }`}
                  >
                    {completed ? (
                      <CheckCircle className="w-6 h-6 text-success" />
                    ) : (
                      <Icon className="w-6 h-6 text-white" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{lesson.title}</h3>
                      {completed && (
                        <CheckCircle className="w-5 h-5 text-success" />
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground mb-3">
                      {lesson.description}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        <Badge
                          variant="outline"
                          className={difficultyColors[lesson.difficulty]}
                        >
                          {lesson.difficulty}
                        </Badge>
                        <Badge variant="outline">+{lesson.xp_reward} XP</Badge>
                      </div>

                      <Button
                        onClick={() => openLesson(lesson)}
                        disabled={completed}
                        size="sm"
                        className="bg-gradient-to-r from-eco-primary to-eco-secondary text-white"
                      >
                        {completed ? "Completed" : "Start Lesson"}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Lesson Content Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <BookOpen className="w-6 h-6 text-primary" />
              {selectedLesson?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedLesson?.category} • {selectedLesson?.difficulty}
            </DialogDescription>
          </DialogHeader>

          {selectedLesson && (
            <div className="space-y-4">
              <div className="prose prose-sm max-w-none dark:prose-invert">
                {selectedLesson.content
                  .split("\n")
                  .map((line: string, index: number) => {
                    // Handle headers
                    if (line.startsWith("# ")) {
                      return (
                        <h1
                          key={index}
                          className="text-2xl font-bold mt-6 mb-4"
                        >
                          {line.substring(2)}
                        </h1>
                      );
                    }
                    if (line.startsWith("## ")) {
                      return (
                        <h2
                          key={index}
                          className="text-xl font-semibold mt-5 mb-3"
                        >
                          {line.substring(3)}
                        </h2>
                      );
                    }
                    if (line.startsWith("### ")) {
                      return (
                        <h3
                          key={index}
                          className="text-lg font-semibold mt-4 mb-2"
                        >
                          {line.substring(4)}
                        </h3>
                      );
                    }
                    // Handle bold
                    if (line.startsWith("**") && line.endsWith("**")) {
                      return (
                        <p key={index} className="font-bold my-2">
                          {line.substring(2, line.length - 2)}
                        </p>
                      );
                    }
                    // Handle list items
                    if (line.startsWith("- ") || line.startsWith("* ")) {
                      return (
                        <li key={index} className="ml-4">
                          {line.substring(2)}
                        </li>
                      );
                    }
                    if (/^\d+\./.test(line)) {
                      return (
                        <li key={index} className="ml-4">
                          {line.substring(line.indexOf(".") + 2)}
                        </li>
                      );
                    }
                    // Handle special markers
                    if (line.startsWith("❌")) {
                      return (
                        <p key={index} className="text-destructive my-1">
                          {line}
                        </p>
                      );
                    }
                    if (line.startsWith("✅")) {
                      return (
                        <p key={index} className="text-success my-1">
                          {line}
                        </p>
                      );
                    }
                    // Regular paragraphs
                    if (line.trim()) {
                      return (
                        <p key={index} className="my-2">
                          {line}
                        </p>
                      );
                    }
                    return <br key={index} />;
                  })}
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <Badge variant="outline" className="text-lg px-4 py-1">
                  +{selectedLesson.xp_reward} XP
                </Badge>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Close
                  </Button>
                  <Button
                    onClick={completeLesson}
                    className="bg-gradient-to-r from-eco-primary to-eco-secondary text-white"
                    disabled={isLessonCompleted(selectedLesson.id)}
                  >
                    {isLessonCompleted(selectedLesson.id)
                      ? "Completed"
                      : "Complete Lesson"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
