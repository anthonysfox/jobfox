import type { Ats } from "../../core/job.js";
import type { JobSource } from "../../core/source.js";
import type { HttpClient } from "../../lib/http.js";
import { ashbyClient } from "./ashby/client.js";
import { greenhouseClient } from "./greenhouse/client.js";
import { leverClient } from "./lever/client.js";
import type { AtsBoard, AtsClient } from "./types.js";

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
