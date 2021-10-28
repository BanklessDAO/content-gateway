import { NetworkProvider } from "./NetworkProvider";
import { GraphQLAPIClient } from "./graph/interface/GraphQLAPIClient";
import TheGraphAPIClient from "./graph/implementation/TheGraphAPIClient";

class DefaultNetworkProvider implements NetworkProvider {
  graph(uri: string): GraphQLAPIClient {
    return new TheGraphAPIClient(uri)
  }
}

export default DefaultNetworkProvider