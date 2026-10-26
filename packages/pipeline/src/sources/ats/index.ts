import type { Ats } from "../../core/job.ts";
import type { JobSource } from "../../core/source.ts";
import type { HttpClient } from "../../lib/http.ts";
import { ashbyClient } from "./ashby/client.ts";
import { greenhouseClient } from "./greenhouse/client.ts";
import { leverClient } from "./lever/client.ts";
import type { AtsBoard, AtsClient } from "./types.ts";

export const atsClients: Record<Ats, AtsClient> = {
  GREENHOUSE: greenhouseClient,
  LEVER: leverClient,
  ASHBY: ashbyClient,
};

/** Poll a company's board directly, as a JobSource like any other. */
export function createAtsBoardSource(http: HttpClient, ats: Ats, board: AtsBoard): JobSource {
  return {
    name: `${ats.toLowerCase()}:${board.slug}`,
    fetchJobs: () => atsClients[ats].listJobs(http, board),
  };
}
