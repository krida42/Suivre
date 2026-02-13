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
    // use std::unit_test::assert_eq;
    use sui::{clock::Clock, coin::Coin, sui::SUI};
    // use sui::{clock::Clock, coin::Coin, dynamic_field as df, sui::SUI};

    // const EInvalidCap: u64 = 0;
    const EInvalidFee: u64 = 1;
    const ENoAccess: u64 = 2;
    // const MARKER: u64 = 3;


    public struct AllCreators has key {
        id: UID,
        creators: table::Table<address, ID>,
    }

    public struct Subscription has key {
        id: UID,
        creator_id: ID,
        created_at: u64,
    }
        
    public struct ContentCreator has key, store {
        id: UID,
        wallet: address,
        pseudo: string::String,
        price_per_month: u64,
        description: string::String,
        image_url: string::String,
    }

    public struct Content has key {
        id: UID,
        content_name: string::String,
        content_description: string::String,
        blob_id: string::String,
    }

    public struct CreatorCap has key {
        id: UID,
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
#[allow(lint(self_transfer))]
    public fun new(allCreators: &mut AllCreators, pseudo: string::String, price_per_month: u64, description: string::String, image_url: string::String, ctx: &mut TxContext)  { 
        let new_creator = ContentCreator {
            id: object::new(ctx),
            pseudo,
            price_per_month,
            description,
            image_url,
            wallet: ctx.sender(),
        };
        transfer::transfer(CreatorCap{id: object::new(ctx)}, ctx.sender());
        table::add(&mut allCreators.creators, ctx.sender(), object::uid_to_inner(&new_creator.id));
        transfer::share_object(new_creator);

        // new_creator

    }

    public fun upload_content(_cap: &CreatorCap, content_name: string::String, content_description: string::String, blob_id: string::String, ctx: &mut TxContext){
        // check if ctx.sender() is a registered creator?
        let new_content = Content {
            id: object::new(ctx),
            content_name,
            content_description,
            blob_id,
        };

        transfer::transfer(new_content, ctx.sender());
        // new_content
        
    }

    public fun is_prefix(prefix: vector<u8>, word: vector<u8>): bool {
        if (prefix.length() > word.length()) {
            return false
        };
        let mut i = 0;
        while (i < prefix.length()) {
            if (prefix[i] != word[i]) {
                return false
            };
            i = i + 1;
        };
        true
    }

    /// All allowlisted addresses can access all IDs with the prefix of the allowlist
    fun check_policy(id: vector<u8>, sub: &Subscription, creator: &ContentCreator, c: &Clock): bool {
        if (object::id(creator) != sub.creator_id) {
            return false
        };
        if (c.timestamp_ms() > sub.created_at + 60 * 60 * 24 * 30 * 1000) {
            return false
        };

        // Check if the id has the right prefix
        is_prefix(creator.id.to_bytes(), id)
    }

    entry fun seal_approve(id: vector<u8>, sub: &Subscription, creator: &ContentCreator, c: &Clock) {
        assert!(check_policy(id, sub, creator, c), ENoAccess);
    }

    public fun subscribe(
        fee: Coin<SUI>,
        creator: &ContentCreator,
        c: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(fee.value() == creator.price_per_month, EInvalidFee);
        transfer::public_transfer(fee, creator.wallet);
        let subscription = Subscription {
            id: object::new(ctx),
            creator_id: object::id(creator),
            created_at: c.timestamp_ms(),
        };
        transfer::transfer(subscription, ctx.sender());
    }


    // Il faut que j ai une fonction upload content, pour les videos, ca prend le blob id 
    // Le content a un nom, description et un blob id
}