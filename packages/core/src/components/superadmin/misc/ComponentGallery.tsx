"use client";

import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Switch } from '../../ui/switch';
import { Checkbox } from '../../ui/checkbox';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Progress } from '../../ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert';
import { Avatar, AvatarFallback } from '../../ui/avatar';
import { Separator } from '../../ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Calendar } from '../../ui/calendar';
import { 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  X,
  Download,
  Heart,
  Star,
  Share,
  Settings,
  TrendingUp,
  DollarSign,
  Users,
  MoreHorizontal,
  ArrowRight,
  Minus,
  Plus
} from "lucide-react";
import { useState } from "react";

/**
 * Component Gallery
 * 
 * Displays comprehensive UI components showcasing both basic elements and 
 * real-world usage patterns inspired by TweakCN.com - perfect for theme testing.
 */
export function ComponentGallery() {
  const [goalValue, setGoalValue] = useState(350);
  const [date, setDate] = useState<Date | undefined>(new Date());

  return (
    <div className="space-y-8">
      
      {/* Basic UI Components */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Components</CardTitle>
          <CardDescription>Essential UI elements and building blocks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Buttons */}
          <div>
            <h4 className="text-sm font-medium mb-3">Buttons</h4>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3">
                <Button>Default</Button>
                <Button size="sm">Small</Button>
                <Button size="lg">Large</Button>
                <Button disabled>Disabled</Button>
                <Button className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  With Icon
                </Button>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="default">Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
              </div>
            </div>
          </div>

          {/* Form Elements */}
          <div>
            <h4 className="text-sm font-medium mb-3">Form Elements</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Input placeholder="Text input..." />
                <Input type="email" placeholder="Email input..." />
                <Textarea placeholder="Textarea..." rows={3} />
              </div>
              <div className="space-y-3">
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select option..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="option1">Option 1</SelectItem>
                    <SelectItem value="option2">Option 2</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center space-x-2">
                  <Switch id="switch-demo" />
                  <Label htmlFor="switch-demo">Enable notifications</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="checkbox-demo" />
                  <Label htmlFor="checkbox-demo">I agree to terms</Label>
                </div>
              </div>
            </div>
          </div>

          {/* Badges and Progress */}
          <div>
            <h4 className="text-sm font-medium mb-3">Badges & Progress</h4>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="destructive">Destructive</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge className="bg-green-100 text-green-800">Success</Badge>
                <Badge className="bg-yellow-100 text-yellow-800">Warning</Badge>
              </div>
              <div className="space-y-2">
                <Progress value={25} />
                <Progress value={60} />
                <Progress value={90} />
              </div>
            </div>
          </div>

          {/* Avatars */}
          <div>
            <h4 className="text-sm font-medium mb-3">Avatars</h4>
            <div className="flex items-center gap-4">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">XS</AvatarFallback>
              </Avatar>
              <Avatar className="h-10 w-10">
                <AvatarFallback className="text-sm">SM</AvatarFallback>
              </Avatar>
              <Avatar className="h-12 w-12">
                <AvatarFallback>MD</AvatarFallback>
              </Avatar>
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg">LG</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Alerts & Notifications</CardTitle>
          <CardDescription>Different alert types and notification styles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Information</AlertTitle>
            <AlertDescription>
              This is an informational alert with additional context.
            </AlertDescription>
          </Alert>

          <Alert className="border-yellow-500 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800">Warning</AlertTitle>
            <AlertDescription className="text-yellow-700">
              Please review your settings before proceeding.
            </AlertDescription>
          </Alert>

          <Alert className="border-red-500 bg-red-50">
            <X className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800">Error</AlertTitle>
            <AlertDescription className="text-red-700">
              Something went wrong. Please try again.
            </AlertDescription>
          </Alert>

          <Alert className="border-green-500 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Success</AlertTitle>
            <AlertDescription className="text-green-700">
              Operation completed successfully!
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Tabs & Navigation</CardTitle>
          <CardDescription>Tabbed interfaces and navigation elements</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="tab1" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="tab1">Tab 1</TabsTrigger>
              <TabsTrigger value="tab2">Tab 2</TabsTrigger>
              <TabsTrigger value="tab3">Tab 3</TabsTrigger>
            </TabsList>
            <TabsContent value="tab1" className="mt-4">
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">Tab 1 Content</h3>
                <p className="text-sm text-muted-foreground">
                  This is the content for the first tab. You can put any content here.
                </p>
              </div>
            </TabsContent>
            <TabsContent value="tab2" className="mt-4">
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">Tab 2 Content</h3>
                <p className="text-sm text-muted-foreground">
                  This is the content for the second tab with different information.
                </p>
              </div>
            </TabsContent>
            <TabsContent value="tab3" className="mt-4">
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">Tab 3 Content</h3>
                <p className="text-sm text-muted-foreground">
                  And this is the content for the third tab.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Accordion */}
      <Card>
        <CardHeader>
          <CardTitle>Accordion</CardTitle>
          <CardDescription>Collapsible content sections for FAQs and grouped information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Single Accordion */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Single Mode (collapsible)</h4>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger>Is it accessible?</AccordionTrigger>
                  <AccordionContent>
                    Yes. It adheres to the WAI-ARIA design pattern for accordions.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                  <AccordionTrigger>Is it styled?</AccordionTrigger>
                  <AccordionContent>
                    Yes. It comes with default styles that match the other components&apos; aesthetic.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3">
                  <AccordionTrigger>Is it animated?</AccordionTrigger>
                  <AccordionContent>
                    Yes. It&apos;s animated by default, but you can disable it if you prefer.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Multiple Accordion */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Multiple Mode</h4>
              <Accordion type="multiple" className="w-full">
                <AccordionItem value="faq-1">
                  <AccordionTrigger>How do I get started?</AccordionTrigger>
                  <AccordionContent>
                    Simply clone the repository and run <code className="bg-muted px-1 rounded">pnpm install</code> to install dependencies.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="faq-2">
                  <AccordionTrigger>Can I customize the theme?</AccordionTrigger>
                  <AccordionContent>
                    Absolutely! All components use CSS variables that can be customized in your theme configuration.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="faq-3">
                  <AccordionTrigger>Is there mobile support?</AccordionTrigger>
                  <AccordionContent>
                    Yes! All components have native React Native implementations in the @nextsparkjs/ui package.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Layout Elements */}
      <Card>
        <CardHeader>
          <CardTitle>Layout Elements</CardTitle>
          <CardDescription>Separators, dividers, and layout helpers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-3">Separators</h4>
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm">Content above</p>
                <Separator className="my-2" />
                <p className="text-sm">Content below</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-3">Icon Buttons</h4>
            <div className="flex gap-2">
              <Button size="sm" variant="outline">
                <Heart className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline">
                <Star className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline">
                <Share className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dashboard Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Dashboard Metrics</CardTitle>
          <CardDescription>Revenue, subscriptions, and key performance indicators</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Revenue Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$15,231.89</div>
                <div className="flex items-center text-xs text-green-600">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +20.1% from last month
                </div>
              </CardContent>
            </Card>

            {/* Subscriptions Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Subscriptions</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">+2,350</div>
                <div className="flex items-center text-xs text-green-600">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +180.1% from last month
                </div>
                <div className="mt-3">
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: '75%' }}></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Calendar & Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Calendar & Activity Tracking</CardTitle>
          <CardDescription>Date selection and goal setting interfaces</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Calendar */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Calendar Component</h4>
              <div className="border rounded-lg p-3 bg-card">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  className="rounded-md mx-auto"
                  showOutsideDays={false}
                />
              </div>
            </div>

            {/* Move Goal Widget */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Goal Setting Widget</h4>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Move Goal</CardTitle>
                  <CardDescription>Set your daily activity goal.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-center space-x-4">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setGoalValue(Math.max(50, goalValue - 50))}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <div className="text-center">
                      <div className="text-3xl font-bold">{goalValue}</div>
                      <div className="text-sm text-muted-foreground">CALORIES/DAY</div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setGoalValue(goalValue + 50)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Exercise Chart Simulation */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Exercise Minutes</div>
                    <div className="flex items-end space-x-1 h-16">
                      {Array.from({ length: 14 }, (_, i) => (
                        <div
                          key={i}
                          className="bg-primary rounded-sm flex-1"
                          style={{ 
                            height: `${Math.random() * 60 + 20}%`,
                            opacity: Math.random() * 0.4 + 0.6 
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <Button className="w-full">Set Goal</Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Tables */}
      <Card>
        <CardHeader>
          <CardTitle>Data Tables</CardTitle>
          <CardDescription>Complex data visualization with status indicators</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold">Payments</h4>
              <div className="text-sm text-muted-foreground">Manage your payments.</div>
            </div>
            
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-[70px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800">Success</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">ken99@example.com</TableCell>
                    <TableCell className="text-right font-medium">$316.00</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800">Success</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">abe45@example.com</TableCell>
                    <TableCell className="text-right font-medium">$242.00</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <Badge className="bg-yellow-100 text-yellow-800">Processing</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">monserrat44@example.com</TableCell>
                    <TableCell className="text-right font-medium">$837.00</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <Badge variant="destructive">Failed</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">carmella@example.com</TableCell>
                    <TableCell className="text-right font-medium">$721.00</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <Badge variant="outline">Pending</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">jason78@example.com</TableCell>
                    <TableCell className="text-right font-medium">$450.00</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800">Success</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">sarah23@example.com</TableCell>
                    <TableCell className="text-right font-medium">$1,280.00</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div>0 of 6 row(s) selected.</div>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" disabled>Previous</Button>
                <Button variant="outline" size="sm">Next</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Cards */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing Components</CardTitle>
          <CardDescription>Subscription plans and pricing tables</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <h3 className="text-2xl font-bold">Pricing</h3>
              <p className="text-muted-foreground">Check out our affordable pricing plans</p>
              <div className="flex items-center justify-center space-x-4">
                <span className="text-sm">Monthly</span>
                <Switch />
                <span className="text-sm">Yearly</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Plus Plan */}
              <Card>
                <CardHeader>
                  <CardTitle>Plus</CardTitle>
                  <CardDescription>For personal use</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-3xl font-bold">$19</div>
                    <div className="text-sm text-muted-foreground">Billed $228 annually</div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Up to 5 team members</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Basic components library</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Community support</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">1GB storage space</span>
                    </div>
                  </div>
                  
                  <Button className="w-full">
                    Purchase
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>

              {/* Pro Plan */}
              <Card className="border-primary">
                <CardHeader>
                  <CardTitle>Pro</CardTitle>
                  <CardDescription>For professionals</CardDescription>
                  <Badge className="w-fit">Most Popular</Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-3xl font-bold">$49</div>
                    <div className="text-sm text-muted-foreground">Billed $588 annually</div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Everything in Plus, and:</div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Unlimited team members</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Advanced components</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Priority support</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Unlimited storage</span>
                    </div>
                  </div>
                  
                  <Button className="w-full">
                    Purchase
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form Components */}
      <Card>
        <CardHeader>
          <CardTitle>Form Components</CardTitle>
          <CardDescription>Complete form elements and validation states</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Text Inputs */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="name@example.com" />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" placeholder="Enter your password" />
              </div>
              <div>
                <Label htmlFor="message">Message</Label>
                <Textarea id="message" placeholder="Type your message here..." />
              </div>
            </div>

            {/* Controls and Selections */}
            <div className="space-y-4">
              <div>
                <Label>Plan Selection</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter Plan</SelectItem>
                    <SelectItem value="pro">Pro Plan</SelectItem>
                    <SelectItem value="enterprise">Enterprise Plan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox id="terms" />
                <Label htmlFor="terms" className="text-sm">
                  I agree to the terms and conditions
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox id="marketing" />
                <Label htmlFor="marketing" className="text-sm">
                  Allow us to send you emails
                </Label>
              </div>
              
              <div className="flex space-x-2">
                <Button variant="outline">Cancel</Button>
                <Button>Submit Form</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contextual Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Contextual Alerts</CardTitle>
          <CardDescription>Real-world notification examples with business context</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Subscription Update</AlertTitle>
            <AlertDescription>
              Your subscription is up to date. Next billing date: June 1, 2024.
            </AlertDescription>
          </Alert>

          <Alert className="border-yellow-500 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800">Payment Due</AlertTitle>
            <AlertDescription className="text-yellow-700">
              Your payment method will be charged in 3 days. Update your billing info if needed.
            </AlertDescription>
          </Alert>

          <Alert className="border-green-500 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Upgrade Successful</AlertTitle>
            <AlertDescription className="text-green-700">
              Your subscription has been upgraded to Pro. Enjoy the new features!
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
