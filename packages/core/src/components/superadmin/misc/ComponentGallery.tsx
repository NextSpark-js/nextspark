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
import { Slider } from '../../ui/slider';
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
import { useTranslations } from "next-intl";

/**
 * Component Gallery
 * 
 * Displays comprehensive UI components showcasing both basic elements and 
 * real-world usage patterns inspired by TweakCN.com - perfect for theme testing.
 */
export function ComponentGallery() {
  const t = useTranslations("superadmin.gallery.components");
  const [goalValue, setGoalValue] = useState(350);
  const [date, setDate] = useState<Date | undefined>(new Date());

  return (
    <div className="space-y-8">
      
      {/* Basic UI Components */}
      <Card>
        <CardHeader>
          <CardTitle>{t('basicComponents')}</CardTitle>
          <CardDescription>{t('essentialUiElementsAnd')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Buttons */}
          <div>
            <h4 className="text-sm font-medium mb-3">{t('buttons')}</h4>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3">
                <Button>{t('default')}</Button>
                <Button size="sm">{t('small')}</Button>
                <Button size="lg">{t('large')}</Button>
                <Button disabled>{t('disabled')}</Button>
                <Button className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  {t('withIcon')}
                </Button>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="default">{t('default')}</Button>
                <Button variant="secondary">{t('secondary')}</Button>
                <Button variant="destructive">{t('destructive')}</Button>
                <Button variant="outline">{t('outline')}</Button>
                <Button variant="ghost">{t('ghost')}</Button>
                <Button variant="link">{t('link')}</Button>
              </div>
            </div>
          </div>

          {/* Form Elements */}
          <div>
            <h4 className="text-sm font-medium mb-3">{t('formElements')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Input placeholder={t('textInput')} />
                <Input type="email" placeholder={t('emailInput')} />
                <Textarea placeholder={t('textarea')} rows={3} />
              </div>
              <div className="space-y-3">
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectOption')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="option1">{t('option1')}</SelectItem>
                    <SelectItem value="option2">{t('option2')}</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center space-x-2">
                  <Switch id="switch-demo" />
                  <Label htmlFor="switch-demo">{t('enableNotifications')}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="checkbox-demo" />
                  <Label htmlFor="checkbox-demo">{t('iAgreeToTerms')}</Label>
                </div>
              </div>
            </div>
          </div>

          {/* Badges and Progress */}
          <div>
            <h4 className="text-sm font-medium mb-3">{t('badgesProgress')}</h4>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge>{t('default')}</Badge>
                <Badge variant="secondary">{t('secondary')}</Badge>
                <Badge variant="destructive">{t('destructive')}</Badge>
                <Badge variant="outline">{t('outline')}</Badge>
                <Badge className="bg-green-100 text-green-800">{t('success')}</Badge>
                <Badge className="bg-yellow-100 text-yellow-800">{t('warning')}</Badge>
              </div>
              <div className="space-y-2">
                <Progress value={25} />
                <Progress value={60} />
                <Progress value={90} />
              </div>
            </div>
          </div>

          {/* Slider */}
          <div>
            <h4 className="text-sm font-medium mb-3">{t('slider')}</h4>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('defaultSlider')}</Label>
                <Slider defaultValue={[50]} max={100} step={1} />
              </div>
              <div className="space-y-2">
                <Label>{t('volume25')}</Label>
                <Slider defaultValue={[25]} max={100} step={5} />
              </div>
              <div className="space-y-2">
                <Label>{t('disabledSlider')}</Label>
                <Slider defaultValue={[75]} max={100} step={1} disabled />
              </div>
            </div>
          </div>

          {/* Avatars */}
          <div>
            <h4 className="text-sm font-medium mb-3">{t('avatars')}</h4>
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
          <CardTitle>{t('alertsNotifications')}</CardTitle>
          <CardDescription>{t('differentAlertTypesAnd')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>{t('information')}</AlertTitle>
            <AlertDescription>
              {t('thisIsAnInformational')}
            </AlertDescription>
          </Alert>

          <Alert className="border-yellow-500 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800">{t('warning')}</AlertTitle>
            <AlertDescription className="text-yellow-700">
              {t('pleaseReviewYourSettings')}
            </AlertDescription>
          </Alert>

          <Alert className="border-red-500 bg-red-50">
            <X className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800">{t('error')}</AlertTitle>
            <AlertDescription className="text-red-700">
              {t('somethingWentWrongPlease')}
            </AlertDescription>
          </Alert>

          <Alert className="border-green-500 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">{t('success')}</AlertTitle>
            <AlertDescription className="text-green-700">
              {t('operationCompletedSuccessfully')}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>{t('tabsNavigation')}</CardTitle>
          <CardDescription>{t('tabbedInterfacesAndNavigation')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="tab1" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="tab1">{t('tab1')}</TabsTrigger>
              <TabsTrigger value="tab2">{t('tab2')}</TabsTrigger>
              <TabsTrigger value="tab3">{t('tab3')}</TabsTrigger>
            </TabsList>
            <TabsContent value="tab1" className="mt-4">
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">{t('tab1Content')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('thisIsTheContent')}
                </p>
              </div>
            </TabsContent>
            <TabsContent value="tab2" className="mt-4">
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">{t('tab2Content')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('thisIsTheContent2')}
                </p>
              </div>
            </TabsContent>
            <TabsContent value="tab3" className="mt-4">
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">{t('tab3Content')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('andThisIsThe')}
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Accordion */}
      <Card>
        <CardHeader>
          <CardTitle>{t('accordion')}</CardTitle>
          <CardDescription>{t('collapsibleContentSectionsFor')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Single Accordion */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">{t('singleModeCollapsible')}</h4>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger>{t('isItAccessible')}</AccordionTrigger>
                  <AccordionContent>
                    {t('yesItAdheresTo')}
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                  <AccordionTrigger>{t('isItStyled')}</AccordionTrigger>
                  <AccordionContent>
                    {t('yesItComesWith')}
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3">
                  <AccordionTrigger>{t('isItAnimated')}</AccordionTrigger>
                  <AccordionContent>
                    {t('yesItSAnimated')}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Multiple Accordion */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">{t('multipleMode')}</h4>
              <Accordion type="multiple" className="w-full">
                <AccordionItem value="faq-1">
                  <AccordionTrigger>{t('howDoIGet')}</AccordionTrigger>
                  <AccordionContent>
                    {t.rich('cloneRepository', { code: (chunks) => <code className="bg-muted px-1 rounded">{chunks}</code> })}
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="faq-2">
                  <AccordionTrigger>{t('canICustomizeThe')}</AccordionTrigger>
                  <AccordionContent>
                    {t('absolutelyAllComponentsUse')}
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="faq-3">
                  <AccordionTrigger>{t('isThereMobileSupport')}</AccordionTrigger>
                  <AccordionContent>
                    {t('nativeSupport')}
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
          <CardTitle>{t('layoutElements')}</CardTitle>
          <CardDescription>{t('separatorsDividersAndLayout')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-3">{t('separators')}</h4>
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm">{t('contentAbove')}</p>
                <Separator className="my-2" />
                <p className="text-sm">{t('contentBelow')}</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-3">{t('iconButtons')}</h4>
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
          <CardTitle>{t('dashboardMetrics')}</CardTitle>
          <CardDescription>{t('revenueSubscriptionsAndKey')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Revenue Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('totalRevenue')}</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$15,231.89</div>
                <div className="flex items-center text-xs text-green-600">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {t('fromLastMonth', { change: '+20.1%' })}
                </div>
              </CardContent>
            </Card>

            {/* Subscriptions Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('subscriptions')}</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">+2,350</div>
                <div className="flex items-center text-xs text-green-600">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {t('fromLastMonth', { change: '+180.1%' })}
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
          <CardTitle>{t('calendarActivityTracking')}</CardTitle>
          <CardDescription>{t('dateSelectionAndGoal')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Calendar */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">{t('calendarComponent')}</h4>
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
              <h4 className="text-sm font-medium">{t('goalSettingWidget')}</h4>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('moveGoal')}</CardTitle>
                  <CardDescription>{t('setYourDailyActivity')}</CardDescription>
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
                      <div className="text-sm text-muted-foreground">{t('caloriesDay')}</div>
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
                    <div className="text-sm font-medium">{t('exerciseMinutes')}</div>
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
                  
                  <Button className="w-full">{t('setGoal')}</Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Tables */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dataTables')}</CardTitle>
          <CardDescription>{t('complexDataVisualizationWith')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold">{t('payments')}</h4>
              <div className="text-sm text-muted-foreground">{t('manageYourPayments')}</div>
            </div>
            
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">{t('status')}</TableHead>
                    <TableHead>{t('email')}</TableHead>
                    <TableHead className="text-right">{t('amount')}</TableHead>
                    <TableHead className="w-[70px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800">{t('success')}</Badge>
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
                      <Badge className="bg-green-100 text-green-800">{t('success')}</Badge>
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
                      <Badge className="bg-yellow-100 text-yellow-800">{t('processing')}</Badge>
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
                      <Badge variant="destructive">{t('failed')}</Badge>
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
                      <Badge variant="outline">{t('pending')}</Badge>
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
                      <Badge className="bg-green-100 text-green-800">{t('success')}</Badge>
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
              <div>{t('n0Of6Row')}</div>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" disabled>{t('previous')}</Button>
                <Button variant="outline" size="sm">{t('next')}</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Cards */}
      <Card>
        <CardHeader>
          <CardTitle>{t('pricingComponents')}</CardTitle>
          <CardDescription>{t('subscriptionPlansAndPricing')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <h3 className="text-2xl font-bold">{t('pricing')}</h3>
              <p className="text-muted-foreground">{t('checkOutOurAffordable')}</p>
              <div className="flex items-center justify-center space-x-4">
                <span className="text-sm">{t('monthly')}</span>
                <Switch />
                <span className="text-sm">{t('yearly')}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Plus Plan */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('plus')}</CardTitle>
                  <CardDescription>{t('forPersonalUse')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-3xl font-bold">$19</div>
                    <div className="text-sm text-muted-foreground">{t('billedAnnually', { amount: '$228' })}</div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">{t('upTo5Team')}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">{t('basicComponentsLibrary')}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">{t('communitySupport')}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">{t('n1gbStorageSpace')}</span>
                    </div>
                  </div>
                  
                  <Button className="w-full">
                    {t('purchase')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>

              {/* Pro Plan */}
              <Card className="border-primary">
                <CardHeader>
                  <CardTitle>{t('pro')}</CardTitle>
                  <CardDescription>{t('forProfessionals')}</CardDescription>
                  <Badge className="w-fit">{t('mostPopular')}</Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-3xl font-bold">$49</div>
                    <div className="text-sm text-muted-foreground">{t('billedAnnually', { amount: '$588' })}</div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-sm font-medium">{t('everythingInPlusAnd')}</div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">{t('unlimitedTeamMembers')}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">{t('advancedComponents')}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">{t('prioritySupport')}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">{t('unlimitedStorage')}</span>
                    </div>
                  </div>
                  
                  <Button className="w-full">
                    {t('purchase')}
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
          <CardTitle>{t('formComponents')}</CardTitle>
          <CardDescription>{t('completeFormElementsAnd')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Text Inputs */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">{t('email')}</Label>
                <Input id="email" type="email" placeholder="name@example.com" />
              </div>
              <div>
                <Label htmlFor="password">{t('password')}</Label>
                <Input id="password" type="password" placeholder={t('enterYourPassword')} />
              </div>
              <div>
                <Label htmlFor="message">{t('message')}</Label>
                <Textarea id="message" placeholder={t('typeYourMessageHere')} />
              </div>
            </div>

            {/* Controls and Selections */}
            <div className="space-y-4">
              <div>
                <Label>{t('planSelection')}</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectAPlan')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">{t('starterPlan')}</SelectItem>
                    <SelectItem value="pro">{t('proPlan')}</SelectItem>
                    <SelectItem value="enterprise">{t('enterprisePlan')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox id="terms" />
                <Label htmlFor="terms" className="text-sm">
                  {t('iAgreeToThe')}
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox id="marketing" />
                <Label htmlFor="marketing" className="text-sm">
                  {t('allowUsToSend')}
                </Label>
              </div>
              
              <div className="flex space-x-2">
                <Button variant="outline">{t('cancel')}</Button>
                <Button>{t('submitForm')}</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contextual Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>{t('contextualAlerts')}</CardTitle>
          <CardDescription>{t('realWorldNotificationExamples')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>{t('subscriptionUpdate')}</AlertTitle>
            <AlertDescription>
              {t('yourSubscriptionIsUp')}
            </AlertDescription>
          </Alert>

          <Alert className="border-yellow-500 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800">{t('paymentDue')}</AlertTitle>
            <AlertDescription className="text-yellow-700">
              {t('yourPaymentMethodWill')}
            </AlertDescription>
          </Alert>

          <Alert className="border-green-500 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">{t('upgradeSuccessful')}</AlertTitle>
            <AlertDescription className="text-green-700">
              {t('yourSubscriptionHasBeen')}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
