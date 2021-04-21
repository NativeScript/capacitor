//
//  App-Bridging-Header.h
//  App
//
//  Created by Osei Fortune on 08/07/2020.
//

#ifndef App_Bridging_Header_h
#define App_Bridging_Header_h
#import "Runtime.h"
#import "NativeScript/NativeScript.h"
#import <mach-o/ldsyms.h>
static const struct mach_header_64 *mhExecHeaderPtr = &_mh_execute_header;
#endif /* App_Bridging_Header_h */

