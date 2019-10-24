<?php
namespace Poker;

/**
 * Class Primes
 */
class Primes
{

	// A while number that cannot be made by multiplying other whole numbers

	// a prime is a number that is divisible by 1 and it self;

	//   4 =  [ 2, 2 ]
	//   5 =  [ 5 ]
	//   6 =  [ 2 , 3 ]
	//  10 =  [ 2 , 5 ]
	//  12 =  [ 2 , 2, 3 ]
	//  100 = [ 2, 2, 5, 5 ]

	//  we can check this is correct by multiplying all numbers in the array together // array_product($arr);

	/**
	 * @param $number
	 *
	 * @return array
	 */

	public function generate($number)
    {
	    $primes = [];

	    for($candidate = 2; $number > 1; $candidate++) {
		    for (; $number % $candidate == 0; $number /= $candidate ) {
			    $primes[] = $candidate;
		    }
	    }

        return $primes;
    }

}
