// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

// This example demonstrates a basic use of a shared greeting.
// Rules:
// - anyone can create and share a Greeting object
// - everyone can update the text of the Greeting object
// module hello_world::greeting {
//   use std::string;

//   /// A shared greeting
//   public struct Greeting has key {
//     id: UID,
//     text: string::String,
//   }
 
//   /// API call that creates a globally shared Greeting object initialized with "Hello world!"
//   public fun new(ctx: &mut TxContext) { 
//     let new_greeting = Greeting { 
//       id: object::new(ctx),
//       text: b"Hello world!".to_string()
//     };
//     transfer::share_object(new_greeting);
//   }

//   /// API call that updates text of Greeting object
//   public fun update_text(greeting: &mut Greeting, new_text: string::String) {
//     greeting.text = new_text;
//   }
// }


module sui_fan::content_creator {
    use std::string;
    use sui::table;


    public struct AllCreators has key {
        id: UID,
        creators: table::Table<address, ID>,
    }
    
    public struct ContentCreator has key, store {
        id: UID,
        wallet: address,
        pseudo: string::String,
        price_per_month: u64,
        description: string::String,
        image_url: string::String,
    }

    fun init(ctx: &mut TxContext) {
        let allCreators = AllCreators {
            id: object::new(ctx),
            creators: table::new<address, ID>(ctx),
        };
        transfer::share_object(allCreators);
    }

    // tx.MoveCall{
    //     target: "sui_fan::content_creator::new",
    //     arguments: [tx.object(creator_list), tx.string(pseudo), tx.pure.u64(price_per_month), tx.string(description), tx.string(image_url)],
    // } 

    public fun new(allCreators: &mut AllCreators, pseudo: string::String, price_per_month: u64, description: string::String, image_url: string::String, ctx: &mut TxContext) : ContentCreator { 
        let new_creator = ContentCreator {
            id: object::new(ctx),
            pseudo,
            price_per_month,
            description,
            image_url,
            wallet: ctx.sender(),
        };
        table::add(&mut allCreators.creators, ctx.sender(), object::uid_to_inner(&new_creator.id));
        new_creator

    }


    // Il faut que j ai une fonction upload content, pour les videos, ca prend le blob id 
    // Le content a un nom, description et un blob id
}