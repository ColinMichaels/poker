<template>
    <div>
        <div class="flex flex-wrap" id="deck" :class="{is_flipped: !is_flipped}" >
                <card
                    :ref="card"
                    v-for="card in cards"
                    :name="card.name"
                    :key="card.name"
                    :is_flipped="is_flipped"
                    v-on:card-clicked="remove"
                ></card>
        </div>
    </div>
</template>

<script>
    import Game from "@/plugins/game/GamePlugin";
    import {TweenMax} from "gsap/TweenMax";
    import Draggable from "gsap/Draggable";
    import Card from "./Card";

    const initData = ()=>({
        is_flipped: false,
        cards: Game.store().cards,
        play_hand : [],
        position: Math.floor(Math.random() * (52 - 1 ) +1),
        selected: null
    });

    export default {
        name: "Deck",
        data() {
            return {
                is_flipped: false,
                cards: Game.store().cards,
                play_hand : [],
                position: Math.floor(Math.random() * (52 - 1 ) +1),
                selected: null
            }
        },
        components: {
            Card
        },
        methods: {
            remove(card){
                card.flipped = !card.flipped;
                Game.sound('/Poker/sounds/card.mp3');
                _.slice(this.cards, _.findIndex(this.cards,  card.name ));
            },
            deal(num_per) {
                this.resetDeck();
                this.is_flipped= false;
            },
            draw(card) {
               let deck_card = this.cards[this.position];
                Game.broadcast('card.start', deck_card.name);
               if(deck_card.name === card){
                   Game.broadcast('game.end');
                   Game.sound('/Poker/sounds/tada.mp3');
                   if(confirm(  'you found the card it was the '+ deck_card.description + '\n would you like to play again?'))
                        this.resetDeck();

               }

            },
            resetDeck(){
                console.log('I should be resetting');
                Object.assign(this.$data , initData());

            },
            flip() {
                this.is_flipped = !this.is_flipped;

                console.log(this.$refs)
                // TweenMax.set(this, {
                //     css:{
                //         transformStyle:"preserve-3d",
                //         perspective:1000,
                //         perspectiveOrigin: '50% 50% 0px'
                //     }
                // });
                Game.sound('/Poker/sounds/card.mp3');
            },
            shuffle() {

               let shuffler =  TweenMax.fromTo(['#dealer','.card-container'], 0.3,
                    {
                        rotation: 360,
                        y: 190,
                        ease: Sine.easeOut,
                    },
                    {
                        rotation: 0,
                        y: 0,
                        x: 0,
                        ease: Sine.easeIn,
                    }
                    , 0.1);

                Game.sound('/Poker/sounds/shuffle.mp3');

               shuffler.eventCallback('onComplete', () => {
                   this.cards = _.shuffle(this.cards);

               });



            },
            updateCard(card){
                this.draw(card);
            }
        },
        mounted() {
            this.deal();
            Game.listen('deck.shuffle', this.shuffle);
            Game.listen('deck.deal', this.deal);
            Game.listen('deck.flip', this.flip);
            Game.listen('deck.reset', this.resetDeck);
            Draggable.create("#deck", {
                type: "y",
                bounds : document.getElementById('app'),
                onClick:function(){
                    console.log('clicked')
                },
                onDragEnd:function(){
                    console.log('drag ended');
                }
            });
        }
    }
</script>
