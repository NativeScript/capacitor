//
//  Runtime.m
//  App
//
//  Created by Osei Fortune on 08/07/2020.
//

#import <Foundation/Foundation.h>
#import <mach-o/ldsyms.h>
#import <mach-o/getsect.h>

static const struct mach_header_64 *mhExecHeaderPtr = &_mh_execute_header;

extern void* runtimeMeta(){
    NSString *sectname = @"__TNSMetadata";
    NSString *segname = @"__DATA";
    unsigned long size;
    void* meta = getsectiondata(&_mh_execute_header, [segname cStringUsingEncoding: NSUTF8StringEncoding], [sectname cStringUsingEncoding: NSUTF8StringEncoding], &size);
    return meta;
}

