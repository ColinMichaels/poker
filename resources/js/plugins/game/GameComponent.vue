<template>
    <div :id="name">
        <div v-show="is_started">
            <h3 class="text-white text-3xl font-black">{{this.name.toUpperCase()}}</h3>
            <div class="game flex flex-wrap flex-wrap-reverse justify-around">
                 <deck></deck>
                <chips></chips>
                <button class="btn py-2 px-4 rounded bg-white text-blue-900" @click="flip_all">Shuffle</button>
            </div>
        </div>
        <div class="game-controls">

        </div>
        <div class="players-panel">
<!--              Wallet amount, Chips in Game , and Stats go here.
            list other players at the table -->
        </div>
        <div class="start flex flex-col content-center justify-center text-center w-1/2 mx-auto" v-show="!is_started">
            <h2 class="text-2xl text-white font-black my-4 animated slideInDown">Welcome to {{name.toUpperCase()}}</h2>
            <div class="players flex py-4">
                <avatar name="robot-03" bgcolor="bg-yellow-400" sound="cha-ching"></avatar>
                <avatar name="batman" bgcolor="bg-black" sound="im-batman"></avatar>
                <avatar name="robot-01" bgcolor="bg-blue-300" sound="robot-blip"></avatar>
                <avatar name="robot-02" bgcolor="bg-red-600" sound="robot-2"></avatar>
            </div>
            <button class="animated tada delay-3s bg-blue-700 hover:bg-blue-900 px-4 py-4 rounded text-3xl font-black text-white" @click="$modal.show('start-game')">Start Game</button>
            <div class="animated delay-3s slideInUp fadeIn mt-10">
                <i class="text-white fa fa-arrow-up fa-4x animated bounce infinite"></i>
            </div>
        </div>

        <modal class="flex-auto" name="start-game">
            <h1 class="font-bold text-2xl mb-6">Ready to play, {{ $page.auth.user.first_name }} ?</h1>
            <chips class="flex w-1/3"></chips>
            <template v-slot:footer>
                <div>
                    <div>
                        <h3>Your Wallet: ${{ $page.auth.user.player.wallet }}</h3>
                    </div>
                    <label for="amount">$Amount to take to the table:</label>
                    <input type="number" name="amount" placeholder="$0" class="mt-2 py-2 px-1 text-2xl bg-gray-200 rounded"/>

                </div>
                <button @click="$modal.show('confirm-cancel-modal')" class="bg-red-700 hover:bg-red-900 px-4 py-2 mr-2 rounded text-sm text-white">Cancel</button>
                <button @click="$game.start('poker')" class="bg-blue-700 hover:bg-blue-900 px-4 py-2 rounded text-sm text-white">Start Game</button>
            </template>
        </modal>
    </div>

</template>

<script>
    import Game  from "@/plugins/game/GamePlugin";
    import Deck from "@/components/Poker/Deck";
    import Card from "@/components/Poker/Card";
    import Chips from "@/components/Poker/Chips";
    import Avatar from "@/components/shared/Avatar";
    import AudioPlugin from "../audio/AudioPlugin";
    let shuffleSound = AudioPlugin.load('/Poker/sounds/shuffle.mp3');

    export default {
        name: "Game",
        props: ['name'],
        components:{
             Deck, Card, Chips,Avatar
        },
        data(){
            return{
                is_started : false
            }
        },
        methods:{
               startGame(){
                    this.is_started = true;
               },
                clickedStart(){
                     shuffleSound.play();
                },
                loadPlayers(){

                },
                flip_all(){
                    Game.events.$emit('deck.shuffle');
                    shuffleSound.play();
                }
        },
        mounted(){
              Game.events.$on('start', this.startGame );
        }
    }
</script>
