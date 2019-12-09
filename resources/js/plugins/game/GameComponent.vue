<template>
    <div :id="name">

        <div v-show="is_running">
            <h3 class="text-white text-3xl font-black mb-20">{{this.name.toUpperCase()}} <span class="text-sm ml-3">Find the card in the deck in the least amount of rounds.</span></h3>

            <div class="game flex flex-wrap  justify-around">
                <div id="dealer" class="w-1/2 mb-4 sm:w-1/12">
                    <avatar name="matrix-trinity" bgcolor="bg-gray-800"/>
                    <h4 class="text-2xl font-black text-white text-center">DEALER</h4>
                </div>
                <deck/>
                <div class="flex m-8">
                    <div v-for="player in num_players">
                        {{player}}
                        <avatar :name="player_avatar" bgcolor="bg-blue-600 w-1/5"/>
                        <chips class="flex flex-wrap w-full px-3" />
                    </div>
                </div>
                <div class="btn-container">
                    <button class="btn py-2 px-4 bg-white text-black" @click="deal">Deal</button>
                    <button class="btn py-2 px-4 bg-white text-black" @click="flip">Flip</button>
                    <button class="btn py-2 px-4 bg-white text-black" @click="shuffle">Shuffle</button>
                    <button class="btn py-2 px-4 bg-white text-black" @click="startGame">New Game</button>
                </div>
            </div>
        </div>
        <div class="game-controls">

        </div>
        <div class="players-panel">
            <!--              Wallet amount, Chips in Game , and Stats go here.
                        list other players at the table -->
        </div>

        <div class="start flex flex-col content-center justify-center text-center w-full mx-auto" v-show="!is_running">
            <h2 class="text-2xl text-white font-black my-4 animated slideInDown mb-4">Welcome to
                {{name.toUpperCase()}}</h2>
            <p class="text-sm text-center text-white">Select your avatar below:</p>
            <avatar-slider/>
            <button
                class="animated tada delay-3s bg-blue-700 hover:bg-blue-900 px-4 py-4 rounded text-3xl font-black text-white w-1/2 mx-auto mt-20 md:mt-40"
                @click="$modal.show('start-game')">Start Game
            </button>
            <div class="animated delay-3s slideInUp fadeIn mt-10">
                <i class="text-white fa fa-arrow-up fa-4x animated bounce infinite"></i>
            </div>
        </div>

        <!--   GAME START MODAL -->
        <modal class="flex-auto" name="start-game">
            <h1 class="font-bold text-2xl mb-6">Ready to play, {{ $page.auth.user.first_name }} ?</h1>
            <chips class="flex h-full w-full"/>
            <template v-slot:footer>
                <div class="flex-col">
                    <div class="mb-4">
                        <h3 class="font-bold">Your Wallet: <span class="text-gray-700">${{ player_wallet }}</span></h3>
                    </div>
                    <div>
                        <label class="font-bold" for="amount">$Amount to take to the table:</label>
                        <input type="number" name="amount" id="amount" placeholder="$0" :value="player_hand"
                               class="mt-2 py-2 px-1 text-2xl bg-gray-200 rounded"/>
                    </div>
                    <div class="flex flex-wrap justify-between">
                        <button @click="$game.start('poker')"
                                class="bg-blue-700 hover:bg-blue-900 text-sm text-white py-4 w-full">Start Game
                        </button>
                    </div>
                </div>
            </template>
        </modal>
    </div>

</template>

<script>
    import Game from "@/plugins/game/GamePlugin";
    import Deck from "@/components/Poker/Deck";
    import Card from "@/components/Poker/Card";
    import Chips from "@/components/Poker/Chips";
    import AvatarSlider from "@/components/shared/AvatarSlider";
    import Avatar from "@/components/shared/Avatar";

    const defaultData = ()=> ({
        is_running: false,
        toggle_debug: false,
        round: 0,
        current_bet: 0,
        current_card: null,
        card_chosen: [],
        card_to_find : null,
        pot: 0,
        last_bet: 0,
        player_hand: 0,
        player_wallet: 0,
        num_players:3,
        player_avatar: 'robot-01'
    });



    export default {
        name: "Game",
        props: {
            name,
            debug:{
                type:Boolean,
                default: false
            }
        },
        components: {
            Avatar,
            Deck, Card, Chips, AvatarSlider
        },
        data() {
            return{
                is_running: false,
                toggle_debug: false,
                round: 0,
                current_bet: 0,
                current_card: null,
                card_chosen: [],
                card_to_find : null,
                pot: 0,
                last_bet: 0,
                player_hand: 0,
                player_wallet: 0,
                num_players:3,
                player_avatar: 'robot-01'
            }
        },
        methods: {
            startGame() {
                //this.updatePlayerWallet(parseInt(this.player_hand) * -1);
                Game.broadcast('deck.reset');
                Object.assign(this.$data, defaultData());
                this.is_running = true;
            },
            endGame(){
                  this.is_running = false;

            },
            addToHand(amount) {
                if (!this.is_running) this.player_hand += parseInt(amount);
            },
            bet(amount){
                this.current_bet += parseInt(amount);
            },
            getCard(card){
                this.current_card = card;
                this.card_chosen.push(card);
                if(this.round < 51){
                    this.round += 1;
                }else{
                    this.is_running = false;
                    alert("You did not find the card in time.  It was the " );
                }

            },
            deal() {
                Game.broadcast('deck.deal');
            },
            shuffle() {
                Game.broadcast('deck.shuffle');
            },
            flip() {
                Game.broadcast('deck.flip');
            },
            getPlayerWallet() {
                axios.get('/wallet')
                    .then(resp => function () {
                        this.player_wallet = resp;
                    })
                    .catch(err => function () {
                        console.log(err);
                    })

            },
            updatePlayerWallet(amount) {

                let method = (amount > 0) ? 'add' : 'sub';

                    axios.patch('/wallet/' + 0, {
                        method: method,
                        amount: Math.abs(amount)
                    });
                    this.player_wallet += amount;

            },
            updatePlayerStats(){
                axios.patch('/player/stats',[{
                        wins: 1,
                        score: 1,
                        game_id: 1
                }]);
            },
            setCardToFind(card){
               this.card_to_find = card;
            },
            toggleDebug(){
                this.debug = !this.debug;
            }
        },
        mounted() {
            Game.listen('game.start',   this.startGame);
            Game.listen('game.end',     this.endGame);
            Game.listen('chip.add',     this.addToHand);
            Game.listen('card.clicked', this.getCard);
            Game.listen('card.start',   this.setCardToFind);
            //this.getPlayerWallet();

            // let handTest2 = Game.rankHand(["10S", "10D", "10H", "JD", "AS"]);
            // console.info(handTest2);


        }
    }
</script>
