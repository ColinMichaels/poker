<template>
    <div>
        <div class="flex flex-wrap" id="deck">
            <card
                :ref="card"
                v-for="card in cards"
                :name="card.name"
                :key="card.id"
                :rank="card.rank"
                :is_flipped="false"
            ></card>
        </div>
       <!-- <div class="font-mono bg-white text-black p-4 my-5">
            <ul>
                <li v-for="card in cards"
                    :key="card.id"
                    :rank="card.rank"
                    :name="card.name">
                    {{card.name}}
                </li>
            </ul>
        </div>-->
    </div>
</template>

<script>
    import Game from "@/plugins/game/GamePlugin";
    import {TweenMax, Power2, TimelineLite} from "gsap/TweenMax";
    import AudioPlugin from "@/plugins/audio/AudioPlugin";
    import CardsList from "@/plugins/game/cardsList";

    let shuffleSound = AudioPlugin.load('/Poker/sounds/shuffle.mp3');
    import Card from "./Card";

    const total_cards = 52;

    const initData = ()=>({
        is_flipped: false,
        cards: Game.store().cards,
        play_hand : [],
        position: Math.floor(Math.random() * (52 - 1 ) +1)
    });

    export default {
        name: "Deck",
        data() {
            return initData();
        },
        components: {
            Card
        },
        methods: {
            deal(num_per) {
                this.resetDeck();
                this.is_flipped= false;
                this.shuffle();
            },
            draw(card) {
               let deck_card = this.cards[this.position];
                Game.broadcast('card.start', deck_card.name);
               if(deck_card.name === card){
                   Game.broadcast('game.end');
                   AudioPlugin.play('/Poker/sounds/tada.mp3');
                   if(confirm(  'you found the card it was the '+ deck_card.description + '\n would you like to play again?'))
                        this.resetDeck();

               }

            },
            resetDeck(){
                console.log('I should be resetting');
                Object.assign(this.$data , initData());
                Object.assign(this.$data.cards, CardsList);
                shuffleSound.play();
            },
            flip() {
                this.is_flipped = !this.is_flipped;
            },
            shuffle() {
                TweenMax.staggerFromTo('.card-container', 0.3,
                    {
                        rotation: 360,
                        y: 190,
                        ease: Sine.easeOut,
                        cycle: {
                            x: [2000, 2000, 2000, -200, -250, -250, 0],
                            y: [0]
                        }
                    },
                    {
                        rotation: 0,
                        y: 0,
                        x: 0,
                        ease: Sine.easeIn,
                    }
                    , 0.1);

                this.cards = _.shuffle(this.cards);
                shuffleSound.play();
            },
            updateCard(card){
                this.draw(card);
            }
        },
        mounted() {
            this.deal();
            Game.listen('card.clicked', this.updateCard);
            Game.listen('deck.shuffle', this.shuffle);
            Game.listen('deck.deal', this.deal);
            Game.listen('deck.flip', this.flip);
            Game.listen('deck.reset', this.resetDeck);
        }
    }
</script>
