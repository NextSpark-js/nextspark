import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { getLocale, getTranslations } from "next-intl/server";
import { sel } from "../../../lib/selectors";
import { getBusinessMetrics } from "../../../lib/services/business-metrics.service";

/**
 * Business metrics, live from Postgres (#267). Rendered only inside this page, which is served only after the
 * area's role check (area-access): the service itself checks nothing.
 */
export async function BusinessMetrics() {
  const [t, locale, metrics] = await Promise.all([getTranslations("superadmin.dashboard.metrics"), getLocale(), getBusinessMetrics()]);
  const number = new Intl.NumberFormat(locale);
  const money = (cents: number, currency: string) => {
    try {
      return new Intl.NumberFormat(locale, { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
    } catch {
      return `${number.format(cents / 100)} ${currency.toUpperCase()}`; // a currency code Intl does not know
    }
  };
  const max = Math.max(1, ...metrics.signupsPerDay.map((d) => d.count));
  const signups = metrics.signupsPerDay.reduce((sum, d) => sum + d.count, 0);
  const tiles = [
    { key: "totalUsers", value: number.format(metrics.totalUsers) },
    { key: "payingUsers", value: number.format(metrics.payingUsers) },
    { key: "payingTeams", value: number.format(metrics.payingTeams) },
  ];

  return (
    <section className="space-y-4" data-cy={sel('superadmin.dashboard.metrics.container')}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map(({ key, value }) => (
          <Card key={key} data-cy={sel('superadmin.dashboard.metrics.card', { name: key })}>
            <CardHeader className="pb-2">
              <CardDescription>{t(key)}</CardDescription>
              <CardTitle className="text-3xl">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
        <Card data-cy={sel('superadmin.dashboard.metrics.card', { name: "mrr" })}>
          <CardHeader className="pb-2">
            <CardDescription>{t("mrr")}</CardDescription>
            {metrics.mrr.length === 0 ? (
              <CardTitle className="text-3xl">{money(0, "usd")}</CardTitle>
            ) : (
              metrics.mrr.map(({ currency, cents }) => (
                <CardTitle key={currency} className="text-3xl">{money(cents, currency)}</CardTitle>
              ))
            )}
          </CardHeader>
        </Card>
      </div>
      <Card data-cy={sel('superadmin.dashboard.metrics.signups')}>
        <CardHeader>
          <CardTitle>{t("signups.title")}</CardTitle>
          <CardDescription>{t("signups.description", { count: signups })}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-end gap-1" role="list">
            {metrics.signupsPerDay.map(({ day, count }) => (
              <div key={day} role="listitem" className="flex-1 h-full flex items-end" title={`${day}: ${count}`} aria-label={`${day}: ${count}`}>
                <div className="w-full rounded-t bg-primary/70" style={{ height: count === 0 ? "2px" : `${(count / max) * 100}%` }} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
