import { notEmpty } from "@shared/util-fp";
import { LoadContext, ScheduleMode } from "@shared/util-loaders";
import { Data, NonEmptyProperty, RequiredProperty } from "@shared/util-schema";
import * as t from "io-ts";
import { HTTPDataLoaderBase } from "../base/HTTPDataLoaderBase";
import { BATCH_SIZE } from "../defaults";

const INFO = {
    namespace: "poap",
    name: "Event",
    version: "V1",
};

@Data({
    info: INFO,
})
class Event {
    @NonEmptyProperty()
    id: string;
    @RequiredProperty()
    fancyId: string;
    @RequiredProperty()
    name: string;
    @RequiredProperty()
    eventUrl: string;
    @RequiredProperty()
    imageUrl: string;
    @RequiredProperty()
    country: string;
    @RequiredProperty()
    city: string;
    @RequiredProperty()
    description: string;
    @NonEmptyProperty()
    year: number;
    @NonEmptyProperty()
    fromAdmin: boolean;
    @NonEmptyProperty()
    virtualEvent: boolean;
    @NonEmptyProperty()
    privateEvent: boolean;
    @NonEmptyProperty()
    eventTemplateId: number;
    @NonEmptyProperty()
    eventHostId: number;
    @NonEmptyProperty()
    startsAt: number;
    @NonEmptyProperty()
    endsAt: number;
    @NonEmptyProperty()
    expiresAt: number;
    @NonEmptyProperty()
    createdAt: number;
}

const EventCodec = t.strict({
    id: t.number,
    fancy_id: t.string,
    name: t.string,
    event_url: t.string,
    image_url: t.string,
    country: t.string,
    city: t.string,
    description: t.string,
    year: t.number,
    start_date: t.string,
    end_date: t.string,
    expiry_date: t.string,
    from_admin: t.boolean,
    virtual_event: t.boolean,
    event_template_id: t.number,
    event_host_id: t.number,
    private_event: t.boolean,
});

const EventsCodec = t.strict({
    items: t.array(
        t.intersection([
            EventCodec,
            t.partial({
                created_date: t.string,
            }),
        ])
    ),
    total: t.number,
    offset: t.number,
    limit: t.number,
});

type Events = t.TypeOf<typeof EventsCodec>;

export class POAPEventLoader extends HTTPDataLoaderBase<Events, Event> {
    public info = INFO;

    protected batchSize = BATCH_SIZE;
    protected type = Event;
    protected cadenceConfig = {
        [ScheduleMode.BACKFILL]: { seconds: 5 },
        [ScheduleMode.INCREMENTAL]: { minutes: 5 },
    };

    protected codec = EventsCodec;

    protected getUrlFor({ limit, cursor }: LoadContext) {
        return `http://api.poap.xyz/paginated-events?sort_field=id&sort_dir=asc&limit=${limit}&offset=${cursor}`;
    }

    protected mapResult(result: Events): Array<Event> {
        return result.items
            .map((event) => {
                try {
                    return {
                        id: `${event.id}`,
                        fancyId: event.fancy_id,
                        name: event.name,
                        eventUrl: event.event_url,
                        imageUrl: event.image_url,
                        country: event.country,
                        city: event.city,
                        description: event.description,
                        year: event.year,
                        fromAdmin: event.from_admin,
                        virtualEvent: event.virtual_event,
                        privateEvent: event.private_event,
                        eventHostId: event.event_host_id,
                        eventTemplateId: event.event_template_id,
                        startsAt: Date.parse(event.start_date),
                        endsAt: Date.parse(event.end_date),
                        expiresAt: Date.parse(event.expiry_date),
                        // TODO: this shouldn't be nullable, but the API doesn't return it
                        createdAt: event.created_date
                            ? parseInt(event.created_date)
                            : -1,
                    };
                } catch (e) {
                    this.logger.warn(`Processing POAP event failed`, e, event);
                    return undefined;
                }
            })
            .filter(notEmpty);
    }

    protected extractCursor(result: Events) {
        return `${result.offset + result.items.length}`;
    }
}

export const createPOAPEventLoader: () => POAPEventLoader = () =>
    new POAPEventLoader();
