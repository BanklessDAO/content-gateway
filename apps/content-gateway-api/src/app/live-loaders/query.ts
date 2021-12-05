import gql from "graphql-tag";

gql`
query TransientQueryMix {
    Live {
      # Up-to-date BANK account info with all the most recent transactions
      # I made it look exactly like what comes from the scheduled loader, so that we can reuse the types
      BanklessToken(address: "0xa1b2c3d4e5f...z9") {
        data {
          address
          balance
          lastTransactionTimestamp
          transactions {
            amount
            toAddress
            fromAddress
          }
        }
  
      # Up-to-date POAP tokens for a given address
      # This is not something we pull via loaders or store, it can be just 
      # requested directly from POAP API's /scan method.
      POAPTokenAccount(address: "0xa1b2c3d4e5f...z9") {
        data {
          {
            event {
              id
              fancy_id
              name
              event_url
              mage_url
              country
              city
              description
              year
              start_date
              end_date
              expiry_date
              created_date
              supply
            }
            tokenId
            owner
            supply
            created
          }
        }
      }
  
      # TODO: Create a query to list all the bounties for a certain tenant/customer ID 
    }
  }
  `;
