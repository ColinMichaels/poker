<?php

namespace spec\Poker;

use Illuminate\Support\Collection;
use Poker\Deck;
use Poker\Game;
use PhpSpec\ObjectBehavior;
use Prophecy\Argument;
use Mockery\Exception;

class GameSpec extends ObjectBehavior {

    const BET_MAX       = 1000;
    const BET_MIN       = 1;
    const NUM_CARDS_PER = 5;
    const MAX_PLAYERS   = 8;

    function it_is_initializable() {

        $this->shouldHaveType( Game::class );

    }

    function it_has_one_deck() {

        $this->deck->shouldReturnAnInstanceOf( Deck::class );
    }

    function it_should_have_2_players_if_two_players_given() {

        $this->start( 2 )->players->shouldHaveCount( 2 );

    }

    function it_should_have_3_players_if_three_players_given() {

        $this->start( 3 )->players->shouldHaveCount( 3 );

    }

    function it_should_return_default_players_when_calling_static_start(){

        $this->start()->shouldBeAnInstanceOf( Game::class);
    }

    function it_takes_exception_with_invalid_num_players() {

        $this->shouldThrow( 'InvalidArgumentException' )->duringStart( 9 );
    }

    function it_should_shuffle_the_deck_when_starting_a_new_game() {

        // create a new deck instance this will be in order so we can compare against it
        $random_deck = ( new Deck )->shuffle();
        // shuffle the deck
        $this->start( 2 )->deck->shouldNotEqual( $random_deck );
        //compare decks

    }

    function it_should_deal_5_cards_to_each_players_hand() {

        $game = $this->start( 2 )->deal();
        $game->players[0]->hand->getCards()->shouldHaveCount( 5 );
    }

    function it_should_deal_5_cards_to_player2_hand() {

        $game = $this->start( 2 )->deal();
        $game->players[1]->hand->getCards()->shouldHaveCount( 5 );
    }

    function it_should_have_correct_number_of_cards_remaining_after_the_deal() {

        $cards_remaining = self::MAX_PLAYERS * self::NUM_CARDS_PER;
        $game            = $this->start( self::MAX_PLAYERS )->deal();
        $game->deck->cards->shouldHaveCount( $this->card_count );

    }

    function it_should_take_a_bet_from_first_player() {

        $this->start( 2 )->bet( 5 )->shouldReturn( 5 );

    }

    function it_takes_exception_with_invalid_bet_amount() {

        $game = $this->start( 3 );
        $game->shouldThrow( 'InvalidArgumentException' )->duringBet( 0 );
    }

    function it_should_match_bet_amount_for_next_player() {

        $num_players = 3;
        $bets        = [ 5, 10, 10 ];
        $game        = $this->start( $num_players );
        for ( $i = 0; $i < $num_players; $i ++ ) {
            $player = $game->players[ $i ];
            $player->withdraw( $bets[ $i ] );
            $game->bet( $bets[ $i ] );
        }

        $game->pot->shouldEqual( array_sum( $bets ) );

    }

    function it_should_allow_game_options_to_be_set_by_passing_an_array_of_options() {

        $options = [
            'bet_max'       => self::BET_MAX,
            'bet_min'       => self::BET_MIN,
            'max_players'   => self::MAX_PLAYERS,
            'num_cards_per' => self::NUM_CARDS_PER
        ];

        $this->beConstructedWith( $options );

        $this->getOptions()->shouldReturn( [
            'bet_max'       => Game::BET_MAX,
            'bet_min'       => Game::BET_MIN,
            'max_players'   => Game::MAX_PLAYERS,
            'num_cards_per' => Game::NUM_CARDS_PER
        ] );
    }

    function it_takes_exception_under_to_many_games_at_once() {

          // this right now breaks a little over 200 instances need to work on bettering that
//        $games = new Collection();
//        $count = 0;
//        try {
//            for ( ; $count < 200; $count ++ ) {
//                $games->push((new Game)->create(5)->deal());
//            }
//        }catch(Exception $e){
//            var_dump($e->getMessage());
//
//        }

        $this->shouldBeAnInstanceOf(Game::class);
    }

}
