<?php
namespace Poker;

use App\User;
use Illuminate\Database\Eloquent\Model;

class Player extends Model
{

	public $name, $hand;

	const STARTING_WALLET = 0;
	protected $guarded = ['*'];

	public function __construct($wallet = null) {
		$this->hand = new Hand();
        $this->name = 'Player-'.uniqid();
	}

	public function user(){
	    return $this->belongsTo(User::class, 'user_id');
    }

	public function chips(){

         return (new Chip($this->wallet))->split();

    }


	public function withdraw($amount){

		 return  $this->wallet -= $amount;

	}

    public function draw($card){
       $this->hand->addCardToHand($card);
    }

}
